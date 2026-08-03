/** Pure reorder helper shared by Forms Studio field/layout editors. */
export function moveItem<T>(items: T[], index: number, dir: -1 | 1): T[] {
  const next = [...items];
  const j = index + dir;
  if (j < 0 || j >= next.length) return items;
  [next[index], next[j]] = [next[j], next[index]];
  return next;
}
