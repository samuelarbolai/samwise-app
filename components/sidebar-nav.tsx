'use client';

import { useState, type ReactNode } from 'react';

// Verbatim copy of samwise-landing/app/page.tsx:FourPointStar — same
// brand mark, pixel-for-pixel. Was previously duplicated inline in
// app/page.tsx before this extraction.
function FourPointStar({ size = 18 }: { size?: number }) {
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

export type SidebarNavItem<Id extends string = string> = {
  id: Id;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
};

// Vertical mirror of samwise-landing's collapse-to-star navbar.
// Built without shadcn's Sidebar — that one slides in/out and reserves
// a sidebar-gap that pushes content. Landing's nav does neither: it's
// ALWAYS fixed-rendered along the edge, and the open/close is pure
// opacity + scale + backdrop-filter, with no layout impact. This is the
// 90°-rotated version of that.
//
// Mouse-enter the strip → opens. Mouse-leave → closes. Click the star
// toggles for touch / accidental-leave recovery.
//
// `wordmarkHref` makes the brand wordmark a link (e.g. back to "/" from
// inside a doc). When omitted it renders as a plain label.
export function SidebarNav<Id extends string>({
  items,
  active,
  onChange,
  wordmarkHref,
  wordmarkSlot,
  footerSlot,
}: {
  items: readonly SidebarNavItem<Id>[];
  active: Id;
  onChange: (id: Id) => void;
  wordmarkHref?: string;
  wordmarkSlot?: ReactNode;
  // Optional content pinned at the bottom of the open nav (e.g. the
  // ritual editor's Immerse / Return fullscreen toggle). Stays inside
  // the open-state fade so it appears with the rest of the nav body.
  footerSlot?: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  const wordmark = (
    <span className="brand-wordmark text-[17px]">
      Samwise
      <span className="brand-wordmark__star">✦</span>
    </span>
  );

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 flex w-[220px] flex-col items-center transition-[background,backdrop-filter,-webkit-backdrop-filter] duration-[250ms] ease-out ${
        open
          ? 'bg-[rgba(255,255,255,0.82)] [backdrop-filter:saturate(150%)_blur(14px)] [-webkit-backdrop-filter:saturate(150%)_blur(14px)]'
          : 'bg-transparent'
      }`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      // pointer-events: only the star is hittable when closed; whole
      // aside is hittable when open. Same trick landing uses so casual
      // mouse motion across the left edge doesn't trigger expansion.
      style={{ pointerEvents: open ? 'auto' : 'none' }}
    >
      {/* The star — always rendered; visible only when closed. */}
      <button
        type="button"
        aria-label={open ? 'Close navigation' : 'Open navigation'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={`absolute left-4 top-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-2 text-[var(--accent-gold)] transition-[opacity,transform] duration-[250ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
          open
            ? 'pointer-events-none scale-[0.6] opacity-0'
            : 'pointer-events-auto scale-100 opacity-100'
        }`}
      >
        <FourPointStar size={20} />
      </button>

      {/* Content — title pinned at top, options at vertical center.
          Fades in + scales from 0.96 → 1, same as landing nav-content. */}
      <div
        aria-hidden={!open}
        className={`flex h-full w-full flex-col items-stretch transition-[opacity,transform] duration-[250ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] ${
          open
            ? 'scale-100 opacity-100'
            : 'pointer-events-none scale-[0.96] opacity-0'
        }`}
      >
        {/* Title — pinned at top, left-aligned to match the menu icons
            (x=24 from aside's left edge: outer px-3 + button px-3). */}
        <div className="flex items-center pl-6 pt-4 pb-2">
          {wordmarkHref ? (
            <a href={wordmarkHref} className="cursor-pointer no-underline">
              {wordmark}
            </a>
          ) : (
            wordmark
          )}
        </div>

        {wordmarkSlot ? (
          <div className="flex items-center pl-6 pb-2">{wordmarkSlot}</div>
        ) : null}

        {/* Options — vertically centered in remaining space. */}
        <div className="flex flex-1 flex-col items-stretch justify-center gap-1 px-3">
          {items.map((item) => {
            const isActive = item.id === active;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onChange(item.id)}
                className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                  isActive
                    ? 'bg-[var(--accent-gold)]/15 text-foreground'
                    : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground'
                }`}
              >
                {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {footerSlot ? <div className="px-3 pb-6 pt-2">{footerSlot}</div> : null}
      </div>

      {/* Invisible hover-zone extension to the right of the strip.
          Same trick as landing's ::after — keeps the cursor from
          falling through a gap while the user is travelling toward
          a menu item. Inherits pointer-events from the parent. */}
      <div className="pointer-events-none absolute inset-y-0 left-full w-16" />
    </aside>
  );
}
