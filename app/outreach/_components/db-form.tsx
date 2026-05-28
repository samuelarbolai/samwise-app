"use client";

import type { ReactNode } from "react";

export function DbField({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="db-field">
      <span className="label-eyebrow db-field__label">{label}</span>
      {children}
      {hint ? <span className="db-field__hint">{hint}</span> : null}
    </label>
  );
}

export function DbInput(
  props: React.InputHTMLAttributes<HTMLInputElement>,
) {
  return <input {...props} className={`db-input ${props.className ?? ""}`} />;
}

export function DbTextarea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return <textarea {...props} className={`db-input db-input--multi ${props.className ?? ""}`} />;
}

export function DbSelect({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[] | string[];
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`db-input db-select ${className ?? ""}`}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

export function DbButton({
  variant = "default",
  ...props
}: {
  variant?: "default" | "primary" | "danger";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`db-btn db-btn--${variant} ${props.className ?? ""}`}
    />
  );
}

export function DbCheckbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="db-checkbox">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
