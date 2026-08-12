export type VsmTimelineVersion = {
  id: number;
  name: string;
  createdAt: Date | string;
  description?: string | null;
};

export function sortVsmVersionsForTimeline<T extends VsmTimelineVersion>(versions: T[]) {
  return [...versions].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function buildVsmComparisonPair<T extends VsmTimelineVersion>(versions: T[], firstId: number, secondId: number): [number, number] | null {
  if (!firstId || !secondId || firstId === secondId) return null;
  const ordered = sortVsmVersionsForTimeline(versions);
  const firstIndex = ordered.findIndex((version) => version.id === firstId);
  const secondIndex = ordered.findIndex((version) => version.id === secondId);
  if (firstIndex < 0 || secondIndex < 0) return null;
  return firstIndex < secondIndex ? [firstId, secondId] : [secondId, firstId];
}
