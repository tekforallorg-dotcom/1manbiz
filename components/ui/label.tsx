import * as React from "react";
import { cn } from "@/lib/utils";

const Label = React.forwardRef<
  HTMLLabelElement,
  React.LabelHTMLAttributes<HTMLLabelElement>
>(({ className, ...props }, ref) => {
  return (
    <label
      ref={ref}
      className={cn(
        "text-[13px] font-semibold text-foreground tracking-[-0.01em] inline-block",
        className,
      )}
      {...props}
    />
  );
});
Label.displayName = "Label";

export { Label };
