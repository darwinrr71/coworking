"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "outline";
};

export default function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "rounded-full px-5 py-2 text-sm font-semibold transition",
        variant === "primary" &&
          "bg-(--color-deep) text-white shadow-[0_14px_35px_rgba(29,42,56,0.25)] hover:-translate-y-0.5 hover:bg-(--color-forest)",
        variant === "ghost" && "text-(--color-deep) hover:text-(--color-forest)",
        variant === "outline" &&
          "border border-(--color-gold) text-(--color-deep) hover:bg-(--color-gold) hover:text-white",
        className
      )}
      {...props}
    />
  );
}

