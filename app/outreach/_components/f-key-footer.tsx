"use client";

import type { ReactNode } from "react";

export interface FKey {
  key: string;
  label: string;
  onClick?: () => void;
  href?: string;
}

export function FKeyFooter({
  keys,
  rightSlot,
}: {
  keys: FKey[];
  rightSlot?: ReactNode;
}) {
  return (
    <footer className="f-key-footer">
      <div className="f-key-footer__keys">
        {keys.map((k) => {
          const content = (
            <>
              <span className="f-key-footer__key">{k.key}</span>
              <span className="f-key-footer__label">{k.label}</span>
            </>
          );
          if (k.href) {
            return (
              <a key={k.key} href={k.href} className="f-key-footer__btn">
                {content}
              </a>
            );
          }
          return (
            <button
              key={k.key}
              type="button"
              onClick={k.onClick}
              className="f-key-footer__btn"
            >
              {content}
            </button>
          );
        })}
      </div>
      {rightSlot ? <div className="f-key-footer__right">{rightSlot}</div> : null}
    </footer>
  );
}
