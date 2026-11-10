import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import Link from "next/link";
import { cx } from "@/lib/format";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "amber";
const variants: Record<Variant, string> = {
  primary: "bg-cane-700 text-white hover:bg-cane-800 disabled:bg-cane-300",
  secondary: "bg-white text-ink border border-stone-300 hover:bg-stone-100 disabled:text-stone-500",
  ghost: "bg-transparent text-cane-700 hover:bg-cane-50",
  danger: "bg-white text-danger border border-danger/40 hover:bg-red-50",
  amber: "bg-sugar-500 text-ink hover:bg-sugar-700 hover:text-white",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "h-9 px-3 text-sm", md: "h-11 px-4 text-[15px]", lg: "h-12 px-5 text-base" };
  return (
    <button
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}

export function LinkButton({ href, variant = "primary", className, children }: { href: string; variant?: Variant; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={cx("inline-flex h-11 items-center justify-center gap-2 rounded-md px-4 text-[15px] font-medium transition-colors", variants[variant], className)}>
      {children}
    </Link>
  );
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-stone-700">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-sm text-danger" role="alert">{error}</p>
      ) : hint ? (
        <p className="text-sm text-stone-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, error, ...props }: InputHTMLAttributes<HTMLInputElement> & { error?: boolean }) {
  return <input className={cx("field-input", className)} aria-invalid={error || undefined} {...props} />;
}

export function Select({ className, error, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }) {
  return (
    <select className={cx("field-input pr-8", className)} aria-invalid={error || undefined} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, error, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  return <textarea className={cx("field-input min-h-[96px]", className)} aria-invalid={error || undefined} {...props} />;
}

export function CheckRow({ name, label, defaultChecked, hint }: { name: string; label: string; defaultChecked?: boolean; hint?: string }) {
  return (
    <label className="flex items-start gap-3 py-2.5 cursor-pointer">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-1 h-5 w-5 rounded border-stone-300 text-cane-700 focus:ring-sugar-500" />
      <span className="text-[15px] leading-6">
        {label}
        {hint && <span className="block text-sm text-stone-500">{hint}</span>}
      </span>
    </label>
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "success" | "danger" | "warn"; children: ReactNode }) {
  const tones = {
    info: "bg-blue-50 text-info border-info/30",
    success: "bg-cane-50 text-cane-800 border-cane-300",
    danger: "bg-red-50 text-danger border-danger/30",
    warn: "bg-sugar-100 text-sugar-700 border-sugar-300",
  };
  return (
    <div role="status" className={cx("rounded-md border px-3.5 py-3 text-[15px] leading-6", tones[tone])}>
      {children}
    </div>
  );
}

export function PageHeader({ title, lead, actions }: { title: string; lead?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
      <div>
        <h1 className="text-2xl sm:text-[28px] font-bold leading-tight tracking-tight">{title}</h1>
        {lead && <p className="mt-1 text-stone-500 text-[15px] max-w-prose">{lead}</p>}
      </div>
      {actions && <div className="flex gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="panel px-6 py-12 text-center">
      <p className="text-lg font-medium">{title}</p>
      {body && <p className="mt-1 text-stone-500 max-w-md mx-auto">{body}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function DescriptionList({ items, cols = 2 }: { items: { label: string; value: ReactNode }[]; cols?: 1 | 2 }) {
  return (
    <dl className={cx("grid grid-cols-1 gap-x-8", cols === 2 && "sm:grid-cols-2")}>
      {items.map((it) => (
        <div key={it.label} className="flex gap-3 py-2 border-b border-stone-100 last:border-b-0">
          <dt className="w-32 shrink-0 text-stone-500 text-sm pt-0.5">{it.label}</dt>
          <dd className="min-w-0 flex-1 text-[15px] [overflow-wrap:anywhere]">{it.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between mb-3">
      <h2 className="text-lg font-bold tracking-tight">{children}</h2>
      {right}
    </div>
  );
}
