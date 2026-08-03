/** Shared motion class helpers — use with foundation motion tokens. */
export const motion = {
  fade: "transition-opacity duration-[var(--motion-standard)] ease-[var(--ease-out)]",
  rise: "transition-[opacity,transform] duration-[var(--motion-slow)] ease-[var(--ease-out)]",
  press: "transition-transform duration-[var(--motion-fast)] active:scale-[0.98]",
  dialog: "transition-[opacity,transform] duration-[var(--motion-standard)] ease-[var(--ease-out)]",
} as const;

export const MOTION_DURATIONS = {
  fast: "var(--motion-fast)",
  standard: "var(--motion-standard)",
  slow: "var(--motion-slow)",
} as const;
