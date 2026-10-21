import * as React from "react";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/domain";

const tones: Record<Tone, string> = {
  neutral: "bg-muted text-muted-foreground ring-border",
  info: "bg-info-soft text-info ring-[#c9d8fa]",
  success: "bg-success-soft text-success ring-[#c5e6d1]",
  warning: "bg-warning-soft text-warning ring-[#f3dcb4]",
  danger: "bg-danger-soft text-danger ring-[#f2c7c7]",
  primary: "bg-primary-soft text-primary ring-[#cfdbef]",
};

export function Badge({
  tone = "neutral",
  className,
  dot = false,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone; dot?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        tones[tone],
        className,
      )}
      {...props}
    >
      {dot && <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-current" />}
      <span className="truncate">{children}</span>
    </span>
  );
}
