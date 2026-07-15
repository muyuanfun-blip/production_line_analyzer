import React, { useRef, useState, useCallback, useMemo } from 'react';

interface VSMProcessCanvas {
  id: number;
  name: string;
  type: 'process' | 'supplier' | 'customer' | 'inventory' | 'transport';
  cycleTime?: number | null;
  manpower?: number | null;
  valueAddedRate?: number | null;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
}

interface VSMFlowCanvas {
  id: number;
  fromProcessId: number;
  toProcessId: number;
  flowType: 'material' | 'information' | 'kanban';
  cycleTime?: number | null;
  quantity?: number | null;
}

interface VSMCanvasProps {
  processes: VSMProcessCanvas[];
  flows: VSMFlowCanvas[];
  onProcessSelect?: (process: VSMProcessCanvas | null) => void;
  onFlowSelect?: (flow: VSMFlowCanvas | null) => void;
  onProcessMove?: (processId: number, x: number, y: number) => void;
  onProcessResize?: (processId: number, width: number, height: number) => void;
  readOnly?: boolean;
}

const GRID_SIZE = 20;
const PROCESS_COLORS: Record<string, string> = {
  process: '#3b82f6',
  supplier: '#10b981',
  customer: '#f59e0b',
  inventory: '#8b5cf6',
  transport: '#ec4899',
};

export const VSMCanvas: React.FC<VSMCanvasProps> = ({
  processes,
  flows,
  onProcessSelect,
  onFlowSelect,
  onProcessMove,
  onProcessResize,
  readOnly = false,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [scale, setScale] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);
  const [selectedProcessId, setSelectedProcessId] = useState<number | null>(null);
  const [selectedFlowId, setSelectedFlowId] = useState<number | null>(null);
  const [draggingProcessId, setDraggingProcessId] = useState<number | null>(null);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartY, setDragStartY] = useState(0);
  const [isPanning, setIsPanning] = useState(false);
  const [panStartX, setPanStartX] = useState(0);
  const [panStartY, setPanStartY] = useState(0);

  // 計算 SVG 座標
  const getSvgCoords = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const x = (clientX - rect.left - panX) / scale;
    const y = (clientY - rect.top - panY) / scale;
    return { x, y };
  }, [scale, panX, panY]);

  // 對齐到格線
  const snapToGrid = useCallback((value: number) => {
    return Math.round(value / GRID_SIZE) * GRID_SIZE;
  }, []);

  // 滑鼠滾輪縮放
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.5, Math.min(3, scale * delta));
    setScale(newScale);
  }, [scale]);

  // 滑鼠按下 - 判斷拖曳工序或平移畫布
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 2) return; // 右鍵忽略
    
    const { x, y } = getSvgCoords(e.clientX, e.clientY);
    
    // 檢查是否點擊到工序
    let hitProcessId: number | null = null;
    for (const process of processes) {
      if (
        x >= process.positionX &&
        x <= process.positionX + process.width &&
        y >= process.positionY &&
        y <= process.positionY + process.height
      ) {
        hitProcessId = process.id;
        break;
      }
    }

    if (hitProcessId && !readOnly) {
      // 拖曳工序
      setDraggingProcessId(hitProcessId);
      setDragStartX(x);
      setDragStartY(y);
      setSelectedProcessId(hitProcessId);
      onProcessSelect?.(processes.find(p => p.id === hitProcessId) || null);
    } else if (e.button === 0) {
      // 平移畫布（左鍵）
      setIsPanning(true);
      setPanStartX(e.clientX);
      setPanStartY(e.clientY);
      setSelectedProcessId(null);
      setSelectedFlowId(null);
      onProcessSelect?.(null);
      onFlowSelect?.(null);
    }
  }, [processes, readOnly, getSvgCoords, onProcessSelect, onFlowSelect]);

  // 滑鼠移動 - 拖曳工序或平移畫布
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingProcessId && !readOnly) {
      const { x, y } = getSvgCoords(e.clientX, e.clientY);
      const process = processes.find(p => p.id === draggingProcessId);
      if (process) {
        const newX = snapToGrid(x - (dragStartX - process.positionX));
        const newY = snapToGrid(y - (dragStartY - process.positionY));
        onProcessMove?.(draggingProcessId, Math.max(0, newX), Math.max(0, newY));
      }
    } else if (isPanning) {
      const deltaX = e.clientX - panStartX;
      const deltaY = e.clientY - panStartY;
      setPanX(panX + deltaX);
      setPanY(panY + deltaY);
      setPanStartX(e.clientX);
      setPanStartY(e.clientY);
    }
  }, [draggingProcessId, isPanning, readOnly, getSvgCoords, snapToGrid, processes, dragStartX, dragStartY, panX, panY, panStartX, panStartY, onProcessMove]);

  // 滑鼠抬起
  const handleMouseUp = useCallback(() => {
    setDraggingProcessId(null);
    setIsPanning(false);
  }, []);

  // 計算流線路徑（貝茲曲線）
  const makePath = useCallback((fromProcess: VSMProcessCanvas, toProcess: VSMProcessCanvas): string => {
    const x1 = fromProcess.positionX + fromProcess.width;
    const y1 = fromProcess.positionY + fromProcess.height / 2;
    const x2 = toProcess.positionX;
    const y2 = toProcess.positionY + toProcess.height / 2;
    
    const controlX = (x1 + x2) / 2;
    return `M ${x1} ${y1} Q ${controlX} ${y1} ${controlX} ${y2} T ${x2} ${y2}`;
  }, []);

  // 渲染格線背景
  const gridPath = useMemo(() => {
    const width = 2000;
    const height = 1500;
    let path = '';
    for (let x = 0; x < width; x += GRID_SIZE) {
      path += `M ${x} 0 L ${x} ${height} `;
    }
    for (let y = 0; y < height; y += GRID_SIZE) {
      path += `M 0 ${y} L ${width} ${y} `;
    }
    return path;
  }, []);

  return (
    <div className="relative w-full h-full bg-slate-900 border border-slate-700 rounded-lg overflow-hidden">
      <svg
        ref={svgRef}
        className="w-full h-full cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          transform: `translate(${panX}px, ${panY}px) scale(${scale})`,
          transformOrigin: '0 0',
          transition: isPanning ? 'none' : 'transform 0.1s ease-out',
        }}
      >
        {/* 格線背景 */}
        <path
          d={gridPath}
          stroke="#334155"
          strokeWidth={0.5}
          fill="none"
          pointerEvents="none"
        />

        {/* 流線 */}
        {flows.map((flow) => {
          const fromProcess = processes.find(p => p.id === flow.fromProcessId);
          const toProcess = processes.find(p => p.id === flow.toProcessId);
          if (!fromProcess || !toProcess) return null;

          const isSelected = selectedFlowId === flow.id;
          const flowColor = flow.flowType === 'material' ? '#3b82f6' : flow.flowType === 'information' ? '#10b981' : '#f59e0b';

          const midX = (fromProcess.positionX + fromProcess.width + toProcess.positionX) / 2;
          const midY = (fromProcess.positionY + fromProcess.height / 2 + toProcess.positionY + toProcess.height / 2) / 2;
          
          return (
            <g key={flow.id}>
              <path
                d={makePath(fromProcess, toProcess)}
                stroke={isSelected ? '#fbbf24' : flowColor}
                strokeWidth={isSelected ? 3 : 2}
                fill="none"
                onClick={() => {
                  setSelectedFlowId(flow.id);
                  onFlowSelect?.(flow);
                }}
                className="cursor-pointer hover:stroke-yellow-300"
              />
              
              {/* 流線標籤（流量和搬運時間） */}
              {(flow.quantity || flow.cycleTime) && (
                <g>
                  <rect
                    x={midX - 30}
                    y={midY - 10}
                    width={60}
                    height={20}
                    fill="#1f2937"
                    stroke={flowColor}
                    strokeWidth={1}
                    rx={3}
                    pointerEvents="none"
                  />
                  <text
                    x={midX}
                    y={midY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize={9}
                    pointerEvents="none"
                  >
                    {flow.quantity ? `${flow.quantity}` : ''}{flow.quantity && flow.cycleTime ? ' / ' : ''}{flow.cycleTime ? `${flow.cycleTime}s` : ''}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* 工序節點 */}
        {processes.map((process) => {
          const isSelected = selectedProcessId === process.id;
          const isDragging = draggingProcessId === process.id;
          const bgColor = PROCESS_COLORS[process.type] || '#6b7280';

          return (
            <g key={process.id}>
              {/* 節點背景 */}
              <rect
                x={process.positionX}
                y={process.positionY}
                width={process.width}
                height={process.height}
                fill={bgColor}
                stroke={isSelected ? '#fbbf24' : isDragging ? '#60a5fa' : '#e5e7eb'}
                strokeWidth={isSelected || isDragging ? 3 : 2}
                rx={4}
                className="cursor-move hover:opacity-80"
                opacity={isDragging ? 0.7 : 1}
              />

              {/* 節點文字 */}
              <text
                x={process.positionX + process.width / 2}
                y={process.positionY + process.height / 2 - 5}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize={12}
                fontWeight="bold"
                pointerEvents="none"
              >
                {process.name}
              </text>

              {/* CT 顯示 */}
              {process.cycleTime && (
                <text
                  x={process.positionX + process.width / 2}
                  y={process.positionY + process.height / 2 + 10}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize={10}
                  pointerEvents="none"
                >
                  CT: {process.cycleTime}s
                </text>
              )}

              {/* 人力徽章 */}
              {process.manpower && (
                <circle
                  cx={process.positionX + process.width - 8}
                  cy={process.positionY + 8}
                  r={6}
                  fill="#ef4444"
                  pointerEvents="none"
                />
              )}
              {process.manpower && (
                <text
                  x={process.positionX + process.width - 8}
                  y={process.positionY + 8}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize={8}
                  fontWeight="bold"
                  pointerEvents="none"
                >
                  {process.manpower}
                </text>
              )}

              {/* 增值率徽章 */}
              {process.valueAddedRate !== null && process.valueAddedRate !== undefined && (
                <circle
                  cx={process.positionX + process.width - 8}
                  cy={process.positionY + process.height - 8}
                  r={6}
                  fill="#8b5cf6"
                  pointerEvents="none"
                />
              )}
              {process.valueAddedRate !== null && process.valueAddedRate !== undefined && (
                <text
                  x={process.positionX + process.width - 8}
                  y={process.positionY + process.height - 8}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize={8}
                  fontWeight="bold"
                  pointerEvents="none"
                >
                  {Math.round(process.valueAddedRate)}%
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {/* 縮放控制 */}
      <div className="absolute bottom-4 right-4 flex gap-2 bg-slate-800 rounded-lg p-2 border border-slate-700">
        <button
          onClick={() => setScale(Math.max(0.5, scale - 0.1))}
          className="px-2 py-1 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded"
        >
          −
        </button>
        <span className="px-2 py-1 text-sm text-slate-300 min-w-12 text-center">
          {Math.round(scale * 100)}%
        </span>
        <button
          onClick={() => setScale(Math.min(3, scale + 0.1))}
          className="px-2 py-1 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded"
        >
          +
        </button>
        <button
          onClick={() => {
            setScale(1);
            setPanX(0);
            setPanY(0);
          }}
          className="px-2 py-1 text-sm bg-slate-700 hover:bg-slate-600 text-white rounded"
        >
          重置
        </button>
      </div>

      {/* 空狀態提示 */}
      {processes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <p className="text-slate-400 text-lg">尚無工序節點</p>
            <p className="text-slate-500 text-sm mt-2">點擊「新增工序」開始設計 VSM</p>
          </div>
        </div>
      )}
    </div>
  );
};
