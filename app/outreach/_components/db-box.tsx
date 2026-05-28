import type { ReactNode } from "react";

interface DbBoxProps {
  title: string;
  rightSlot?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

export function DbBox({ title, rightSlot, children, className, bodyClassName }: DbBoxProps) {
  return (
    <section className={`db-box ${className ?? ""}`}>
      <div className="db-box__chrome">
        <span className="db-box__title">{title}</span>
        {rightSlot ? <span className="db-box__chrome-right">{rightSlot}</span> : null}
      </div>
      <div className={`db-box__body ${bodyClassName ?? ""}`}>{children}</div>
    </section>
  );
}
