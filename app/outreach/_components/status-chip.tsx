import type { CSSProperties } from "react";

const STATUS_STYLE: Record<string, { bg: string; fg: string; border: string }> = {
  Queued: { bg: "transparent", fg: "var(--ink-muted)", border: "var(--rule)" },
  Sent: { bg: "transparent", fg: "var(--ink-muted)", border: "var(--rule)" },
  Replied: { bg: "transparent", fg: "var(--amber-deep)", border: "var(--amber-deep)" },
  Scheduled: { bg: "transparent", fg: "var(--amber-deep)", border: "var(--amber-deep)" },
  Prospecting: { bg: "transparent", fg: "var(--amber-deep)", border: "var(--amber-deep)" },
  "Fit Assessment": { bg: "transparent", fg: "var(--amber-deep)", border: "var(--amber-deep)" },
  Disqualified: { bg: "transparent", fg: "var(--ash)", border: "var(--ash)" },
  Optimization: { bg: "transparent", fg: "var(--moss)", border: "var(--moss)" },
  Recommendation: { bg: "var(--accent-gold)", fg: "var(--ink)", border: "var(--accent-gold)" },
  Dead: { bg: "transparent", fg: "var(--ash)", border: "var(--ash)" },
};

export function StatusChip({ status }: { status: string }) {
  const palette = STATUS_STYLE[status] ?? {
    bg: "transparent",
    fg: "var(--ink-muted)",
    border: "var(--rule)",
  };
  const style: CSSProperties = {
    background: palette.bg,
    color: palette.fg,
    border: `1px solid ${palette.border}`,
  };
  return (
    <span className="status-chip" style={style}>
      {status.toUpperCase()}
    </span>
  );
}
