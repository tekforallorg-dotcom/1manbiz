import type { ReactNode } from "react";
import { AlertCircle, CheckCircle2, Info, type LucideIcon } from "lucide-react";

type NoticeVariant = "error" | "success" | "info";

// Internal inline notification used across the dashboard in place of the old
// hand-rolled red alert boxes. Error keeps a clear red read; success and info
// sit on the brand and neutral design tokens. Bordered to match the design bar.
const VARIANTS: Record<NoticeVariant, { container: string; iconColor: string; Icon: LucideIcon }> = {
  error: {
    container: "border-red-200 bg-red-50 text-red-700",
    iconColor: "text-red-500",
    Icon: AlertCircle,
  },
  success: {
    container: "border-brand-primary/20 bg-brand-soft text-brand-dark",
    iconColor: "text-brand-primary",
    Icon: CheckCircle2,
  },
  info: {
    container: "border-border bg-surface-muted text-text-secondary",
    iconColor: "text-text-muted",
    Icon: Info,
  },
};

export function Notice({
  variant = "error",
  title,
  className,
  children,
}: {
  variant?: NoticeVariant;
  title?: string;
  className?: string;
  children: ReactNode;
}) {
  const v = VARIANTS[variant];
  const Icon = v.Icon;
  return (
    <div
      role="alert"
      className={
        "flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm " +
        v.container +
        (className ? " " + className : "")
      }
    >
      <Icon size={16} strokeWidth={2} className={"mt-0.5 shrink-0 " + v.iconColor} />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-medium">{title}</p> : null}
        <div className={title ? "mt-0.5" : ""}>{children}</div>
      </div>
    </div>
  );
}
