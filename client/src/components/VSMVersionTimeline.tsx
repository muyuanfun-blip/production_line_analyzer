import { Clock3, GitCompareArrows, History } from "lucide-react";
import { sortVsmVersionsForTimeline, type VsmTimelineVersion } from "../../../shared/vsmVersionTimeline";

type Props = {
  versions: VsmTimelineVersion[];
  focusedVersionId: number | null;
  compareAnchorId: number | null;
  onFocus: (id: number) => void;
  onCompare: (id: number) => void;
};

export function VSMVersionTimeline({ versions, focusedVersionId, compareAnchorId, onFocus, onCompare }: Props) {
  const timeline = sortVsmVersionsForTimeline(versions);
  if (!timeline.length) return null;
  return (
    <div className="border-b border-slate-700 bg-slate-900/70 px-4 py-2.5">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200"><History className="h-3.5 w-3.5 text-violet-300" />版本時間軸</div>
        <span className="text-[11px] text-slate-500">點選版本聚焦；以「比較」配對兩個版本</span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {timeline.map((version, index) => {
          const focused = focusedVersionId === version.id;
          const anchored = compareAnchorId === version.id;
          return <div key={version.id} className="flex min-w-[138px] items-center gap-2">
            {index > 0 && <div className="h-px w-4 shrink-0 bg-violet-500/35" />}
            <button type="button" onClick={() => onFocus(version.id)} className={`min-w-[114px] rounded border px-2.5 py-2 text-left transition ${focused ? "border-violet-400 bg-violet-500/15" : "border-slate-700 bg-slate-950/35 hover:border-slate-500"}`}>
              <span className="block truncate text-xs font-semibold text-slate-100">{version.name}</span>
              <span className="mt-1 flex items-center gap-1 text-[10px] text-slate-500"><Clock3 className="h-3 w-3" />{new Date(version.createdAt).toLocaleString("zh-TW", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            </button>
            <button type="button" onClick={() => onCompare(version.id)} className={`rounded p-1.5 transition ${anchored ? "bg-violet-500/25 text-violet-200" : "text-slate-400 hover:bg-slate-800 hover:text-violet-200"}`} title={anchored ? "已選為比較起點" : "與另一版本比較"}><GitCompareArrows className="h-3.5 w-3.5" /></button>
          </div>;
        })}
      </div>
    </div>
  );
}
