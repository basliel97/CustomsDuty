import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type BadgeTone = "gray" | "blue" | "green" | "yellow" | "red" | "purple";

const toneClasses: Record<BadgeTone, string> = {
  gray: "bg-gray-100 text-gray-700 ring-gray-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  yellow: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  purple: "bg-violet-50 text-violet-700 ring-violet-200",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

export function Badge({ className, tone = "gray", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}

const ASSESSMENT_TONES: Record<string, BadgeTone> = {
  DRAFT: "gray",
  SUBMITTED: "yellow",
  APPROVED: "blue",
  PAID: "green",
  REJECTED: "red",
  CANCELLED: "gray",
  PLEDGED: "purple",
};

const USER_STATUS_TONES: Record<string, BadgeTone> = {
  ACTIVE: "green",
  PENDING_VERIFICATION: "yellow",
  SUSPENDED: "red",
  LOCKED: "red",
};

export function StatusBadge({ status }: { status: string }) {
  const tone = ASSESSMENT_TONES[status] ?? "gray";
  return <Badge tone={tone}>{status.replaceAll("_", " ")}</Badge>;
}

export function UserStatusBadge({ status }: { status: string }) {
  const tone = USER_STATUS_TONES[status] ?? "gray";
  return <Badge tone={tone}>{status.replaceAll("_", " ")}</Badge>;
}