import type { CSSProperties } from "react";

// Position in a list, for the staggered entrance (`.reveal` reads --i). Capped so a long list never makes anyone wait.
export const revealStyle = (i: number): CSSProperties => ({ "--i": Math.min(i, 8) } as CSSProperties);
