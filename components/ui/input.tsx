import * as React from "react";
import { cn } from "@/lib/utils";

const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-[14.5px] text-foreground placeholder:text-text-muted",
        "focus:outline-none focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/15",
        "disabled:cursor-not-allowed disabled:opacity-50",
        "transition-colors duration-200",
        className,
      )}
      {...props}
    />
  );
});
Input.displayName = "Input";

export { Input };
