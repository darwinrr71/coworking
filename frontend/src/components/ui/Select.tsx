"use client";

import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export default function Select({ className, ...props }: SelectProps) {
  return (
    <select
      className={cn(
        "w-full rounded-2xl border border-[rgba(29,42,56,0.12)] bg-white/80 px-4 py-3 text-sm text-(--color-ink) shadow-[0_10px_30px_rgba(29,42,56,0.08)] outline-none transition focus:border-(--color-gold)",
        className
      )}
      {...props}
    />
  );
}

