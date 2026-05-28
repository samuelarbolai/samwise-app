import type { ReactNode } from "react";
import Link from "next/link";

interface PageShellProps {
  workspace: string;
  currentSection: string;
  children: ReactNode;
  footer?: ReactNode;
}

const SECTIONS = [
  { slug: "today", label: "Today" },
  { slug: "contacts", label: "Contacts" },
  { slug: "templates", label: "Templates" },
  { slug: "recommendations", label: "Recommendations" },
  { slug: "mistakes", label: "Mistakes" },
];

export function PageShell({ workspace, currentSection, children, footer }: PageShellProps) {
  return (
    <div className="paper-module">
      <div className="page-shell">
        <header className="page-shell__head">
          <div className="page-shell__brand">
            <img
              src="/star.svg"
              width="14"
              height="14"
              alt=""
              className="page-shell__star"
            />
            <span className="page-title page-shell__title">
              samwise <span className="page-shell__dot">·</span> outreach
            </span>
          </div>
          <nav className="page-shell__nav">
            {SECTIONS.map((s) => {
              const active = s.slug === currentSection;
              return (
                <Link
                  key={s.slug}
                  href={`/outreach/${workspace}/${s.slug}`}
                  className={
                    active
                      ? "page-shell__navlink page-shell__navlink--active"
                      : "page-shell__navlink"
                  }
                >
                  {s.label}
                </Link>
              );
            })}
          </nav>
        </header>
        <main className="page-shell__main">{children}</main>
        {footer}
      </div>
    </div>
  );
}
