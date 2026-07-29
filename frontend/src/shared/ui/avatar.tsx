import { initials } from "@/shared/utils/format";
import { cn } from "@/shared/utils/cn";

export function Avatar({
  name,
  color,
  size = 40,
  className,
}: {
  name: string;
  color?: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-card",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(11, size * 0.36),
        background: color ?? "var(--primary)",
      }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}
