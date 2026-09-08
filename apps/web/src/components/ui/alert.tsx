import { AlertCircle, CheckCircle2, Info, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type AlertTone = "info" | "success" | "warning" | "error";

const config: Record<AlertTone, { icon: typeof Info; className: string }> = {
  info: { icon: Info, className: "border-blue-200 bg-blue-50 text-blue-800" },
  success: { icon: CheckCircle2, className: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  warning: { icon: AlertCircle, className: "border-amber-200 bg-amber-50 text-amber-800" },
  error: { icon: XCircle, className: "border-red-200 bg-red-50 text-red-800" },
};

export function Alert({ tone = "info", title, children, className }: { tone?: AlertTone; title?: string; children?: React.ReactNode; className?: string }) {
  const { icon: Icon, className: toneClass } = config[tone];
  return (
    <div className={cn("flex gap-3 rounded-lg border px-4 py-3 text-sm", toneClass, className)} role={tone === "error" ? "alert" : "status"}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className="text-sm">{children}</div>
      </div>
    </div>
  );
}