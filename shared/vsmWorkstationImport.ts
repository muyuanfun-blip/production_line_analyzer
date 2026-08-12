export type ImportableWorkstation = { id: number; name: string; sequenceOrder: number; cycleTime: string | number | null; manpower: string | number | null };

export function buildVsmWorkstationImportPlan(workstations: ImportableWorkstation[]) {
  const ordered = [...workstations].sort((a, b) => a.sequenceOrder - b.sequenceOrder || a.id - b.id);
  return {
    processes: ordered.map((workstation, index) => ({
      workstationId: workstation.id,
      name: workstation.name,
      cycleTime: Number(workstation.cycleTime || 0) || null,
      manpower: Number(workstation.manpower || 0) || null,
      positionX: 100 + index * 190,
      positionY: 180,
    })),
    links: ordered.slice(1).map((workstation, index) => ({ fromWorkstationId: ordered[index].id, toWorkstationId: workstation.id })),
  };
}
