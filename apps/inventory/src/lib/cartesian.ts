/** Cartesian product of axis key → values. */
export function cartesian(axes: Record<string, string[]>): Record<string, string>[] {
  const keys = Object.keys(axes);
  if (keys.length === 0) return [];
  return keys.reduce<Record<string, string>[]>(
    (acc, key) => {
      const values = axes[key];
      if (!acc.length) return values.map((v) => ({ [key]: v }));
      return acc.flatMap((row) => values.map((v) => ({ ...row, [key]: v })));
    },
    []
  );
}
