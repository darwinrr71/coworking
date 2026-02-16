"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type TimeFieldProps = {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  name?: string;
};

const inputClassName =
  "w-full rounded-2xl border border-[rgba(29,42,56,0.12)] bg-white/80 px-4 py-3 text-sm text-(--color-ink) shadow-[0_10px_30px_rgba(29,42,56,0.08)] outline-none transition focus:border-(--color-gold)";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function parseHour(value: string | undefined) {
  if (!value || !/^\d{1,2}$/.test(value)) {
    return null;
  }
  const hour = Number(value);
  if (Number.isNaN(hour)) {
    return null;
  }
  return clamp(hour, 8, 22);
}

function formatHour(hour: number) {
  return String(hour).padStart(2, "0");
}

export default function TimeField({
  value,
  defaultValue = "",
  onChange,
  placeholder = "HH",
  className,
  id,
  name,
}: TimeFieldProps) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const displayValue = isControlled ? value : internalValue;

  const emitChange = useCallback(
    (nextValue: string) => {
      if (!isControlled) {
        setInternalValue(nextValue);
      }
      onChange?.(nextValue);
    },
    [isControlled, onChange]
  );

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      emitChange(event.target.value);
    },
    [emitChange]
  );

  const handleBlur = useCallback(() => {
    const parsed = parseHour(displayValue);
    if (parsed === null) {
      return;
    }
    emitChange(formatHour(parsed));
  }, [displayValue, emitChange]);

  const handleStep = useCallback(
    (direction: 1 | -1) => {
      const current = parseHour(displayValue) ?? 8;
      const next = clamp(current + direction, 8, 22);
      emitChange(formatHour(next));
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.setSelectionRange(0, 2);
      });
    },
    [displayValue, emitChange]
  );

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        inputMode="numeric"
        className={cn(inputClassName, "pr-12 text-center", className)}
        aria-label="HH"
        ref={inputRef}
      />
      <div className="absolute right-1 top-1/2 -translate-y-1/2">
        <div className="flex flex-col gap-0 rounded-xl bg-transparent">
          <button
            type="button"
            onClick={() => handleStep(1)}
            className="bg-transparent px-2 py-0.5 text-[10px] font-semibold text-(--color-ink) leading-none hover:bg-[rgba(29,42,56,0.04)]"
            aria-label="Increase time"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={() => handleStep(-1)}
            className="bg-transparent px-2 py-0.5 text-[10px] font-semibold text-(--color-ink) leading-none hover:bg-[rgba(29,42,56,0.04)]"
            aria-label="Decrease time"
          >
            ▼
          </button>
        </div>
      </div>
    </div>
  );
}

