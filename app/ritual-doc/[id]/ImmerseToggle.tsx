'use client';

// Verbatim FourPointStar from samwise-landing/app/page.tsx — same
// pixel-for-pixel mark used in the sidebar nav header. Kept inline
// here (rather than imported from sidebar-nav) so the asset stays
// self-contained per surface.
function FourPointStar({ size = 14 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 0 Q13 11, 24 12 Q13 13, 12 24 Q11 13, 0 12 Q11 11, 12 0 Z" />
    </svg>
  );
}

// Brand-appropriate fullscreen toggle. Lives in the SidebarNav footer
// of `/ritual-doc/[id]`. Two states:
//   - Not fullscreen → ✦ Immerse (gold star, Fraunces label). On
//     hover the star scales up subtly — telegraphs the expansion-to-
//     fullscreen action.
//   - Fullscreen     → ✕ Return  (ash hairline, smaller label).
// Esc exits natively at the browser level; this button mirrors that
// affordance for users who don't know the shortcut.
export function ImmerseToggle({
  isFullscreen,
  onToggle,
}: {
  isFullscreen: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isFullscreen ? 'Return from fullscreen (Esc)' : 'Immerse — enter fullscreen'}
      title={isFullscreen ? 'Return (Esc)' : 'Immerse'}
      className="group flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-foreground/5"
    >
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center transition-transform duration-[250ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
          isFullscreen
            ? 'text-muted-foreground group-hover:rotate-90'
            : 'text-[var(--accent-gold)] group-hover:scale-125'
        }`}
      >
        {isFullscreen ? (
          // Use the same star but shrunken — visually says "collapse".
          // A literal ✕ would feel jarring next to the gold star above.
          <FourPointStar size={10} />
        ) : (
          <FourPointStar size={14} />
        )}
      </span>
      <span
        className="text-sm tracking-wide text-muted-foreground group-hover:text-foreground"
        style={{ fontFamily: 'var(--app-fraunces, "Fraunces", serif)' }}
      >
        {isFullscreen ? 'Return' : 'Immerse'}
      </span>
    </button>
  );
}
