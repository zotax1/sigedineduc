import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { formatNumber } from "@/lib/format";

export function Kpi({
  label,
  value,
  icon: Icon,
  href,
  tone = "primary",
  hint,
}: {
  label: string;
  value: number;
  icon: LucideIcon;
  href?: string;
  tone?: "primary" | "warning" | "danger" | "success";
  hint?: string;
}) {
  const tones = {
    primary: "bg-primary-soft text-primary",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
    success: "bg-success-soft text-success",
  };
  const body = (
    <Card className="h-full transition-shadow group-hover:shadow-md">
      <CardContent className="flex items-start justify-between gap-3 py-4">
        <div className="min-w-0 space-y-1">
          <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
          <p className="tabular text-3xl font-semibold tracking-tight">{formatNumber(value)}</p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${tones[tone]}`}>
          <Icon className="size-5" aria-hidden />
        </span>
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="group block rounded-lg">
      {body}
    </Link>
  ) : (
    body
  );
}
