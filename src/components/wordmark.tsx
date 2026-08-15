import { APP_NAME } from "@/lib/brand";
import { cx } from "@/components/ui";

/**
 * The mark is an answer grid with one bubble filled — the one thing every
 * candidate in the country recognises on sight.
 */
export function Mark({ className = "size-5" }: { className?: string }) {
  const cells = [0, 1, 2].flatMap((row) => [0, 1, 2].map((col) => ({ row, col })));
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden="true">
      <rect x="0.5" y="0.5" width="19" height="19" rx="4" className="fill-ink" />
      {cells.map(({ row, col }) => {
        const filled = row === 1 && col === 1;
        return (
          <circle
            key={`${row}-${col}`}
            cx={5 + col * 5}
            cy={5 + row * 5}
            r={filled ? 1.9 : 1.4}
            className={filled ? "fill-surface" : "fill-surface/35"}
          />
        );
      })}
    </svg>
  );
}

export function Wordmark({
  className,
  markClassName = "size-5",
  size = "md",
}: {
  className?: string;
  markClassName?: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span className={cx("inline-flex items-center gap-2", className)}>
      <Mark className={markClassName} />
      <span
        className={cx(
          "font-display font-semibold tracking-tight text-ink",
          size === "lg" ? "text-xl" : size === "sm" ? "text-[15px]" : "text-[17px]",
        )}
      >
        {APP_NAME}
      </span>
    </span>
  );
}
