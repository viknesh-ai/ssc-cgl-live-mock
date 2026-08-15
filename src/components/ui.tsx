/**
 * Interface primitives.
 *
 * Deliberately plain: hairline borders instead of shadows, one accent colour,
 * and colour used only where it carries meaning. Panels are for genuinely
 * separate areas of work, not for every paragraph.
 */
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "quiet" | "danger";
  size?: "sm" | "md";
};

const BUTTON_VARIANTS: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary: "bg-ink text-white border-ink hover:bg-black disabled:hover:bg-ink",
  secondary: "bg-surface text-ink border-line-strong hover:bg-subtle",
  quiet: "bg-transparent text-ink-2 border-transparent hover:bg-line/60 hover:text-ink",
  danger: "bg-surface text-bad border-bad/35 hover:bg-bad-soft",
};

export function Button({ variant = "secondary", size = "md", className, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-md border font-medium",
        "transition-colors disabled:cursor-not-allowed disabled:opacity-45",
        size === "sm" ? "h-8 px-3 text-[13px]" : "h-9.5 px-4 text-sm",
        BUTTON_VARIANTS[variant],
        className,
      )}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "h-9.5 w-full rounded-md border border-line-strong bg-surface px-3 text-sm text-ink",
        "placeholder:text-ink-3 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/15",
        className,
      )}
    />
  );
}

export function Panel({
  children,
  className,
  ...rest
}: { children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div {...rest} className={cx("rounded-lg border border-line bg-surface", className)}>
      {children}
    </div>
  );
}

export function PanelHeader({
  title,
  meta,
  actions,
}: {
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold tracking-tight text-ink">{title}</h2>
        {meta ? <p className="mt-0.5 text-[13px] text-ink-2">{meta}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return (
<span className="eyebrow">{children}</span>
  );
}

/** A single number with its name — used in rows, never boxed individually. */
export function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  tone?: "default" | "ok" | "warn" | "bad";
}) {
  const toneClass = {
    default: "text-ink",
    ok: "text-ok",
    warn: "text-warn",
    bad: "text-bad",
  }[tone];
  return (
    <div className="px-5 py-3.5">
      <Label>{label}</Label>
      <div className={cx("tabular mt-1 font-display text-xl tracking-tight", toneClass)}>
        {value}
      </div>
    </div>
  );
}

export function StatRow({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-2 divide-x divide-line border-b border-line sm:grid-cols-4">
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "ok" | "warn" | "bad" | "accent";
}) {
  const tones = {
    neutral: "border-line-strong bg-subtle text-ink-2",
    ok: "border-ok/25 bg-ok-soft text-ok",
    warn: "border-warn/25 bg-warn-soft text-warn",
    bad: "border-bad/25 bg-bad-soft text-bad",
    accent: "border-accent/25 bg-accent-soft text-accent",
  }[tone];
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[12px] font-medium",
        tones,
      )}
    >
      {children}
    </span>
  );
}

export function Notice({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "warn" | "bad";
}) {
  const tones = {
    neutral: "border-line bg-subtle text-ink-2",
    warn: "border-warn/25 bg-warn-soft text-warn",
    bad: "border-bad/25 bg-bad-soft text-bad",
  }[tone];
  return (
    <div className={cx("rounded-md border px-4 py-3 text-[13px] leading-relaxed", tones)}>
      {children}
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="px-5 py-10 text-center">
      <p className="text-sm font-medium text-ink-2">{title}</p>
      {hint ? <p className="mt-1 text-[13px] text-ink-3">{hint}</p> : null}
    </div>
  );
}

/** A blocking question. Used where a wrong click costs the candidate marks. */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel = "Go back",
  tone = "primary",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/35 px-5"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-lg border border-line bg-surface p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-lg tracking-tight text-ink">{title}</h2>
        <div className="mt-2 text-[13.5px] leading-relaxed text-ink-2">{body}</div>
        <div className="mt-6 flex justify-end gap-2">
          <Button onClick={onCancel}>{cancelLabel}</Button>
          <Button variant={tone === "danger" ? "danger" : "primary"} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cx(
        "inline-block size-4 animate-spin rounded-full border-2 border-line-strong border-t-ink-2",
        className,
      )}
    />
  );
}
