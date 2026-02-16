"use client";

import { useCallback, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type NumberFieldProps = {
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  name?: string;
  min?: number;
  max?: number;
  step?: number;
};

const inputClassName =
  "w-full rounded-2xl border border-[rgba(29,42,56,0.12)] bg-white/80 px-4 py-3 text-sm text-(--color-ink) shadow-[0_10px_30px_rgba(29,42,56,0.08)] outline-none transition focus:border-(--color-gold)";

function clamp(value: number, min?: number, max?: number) {
  let result = value;
  if (min !== undefined) result = Math.max(min, result);
  if (max !== undefined) result = Math.min(max, result);
  return result;
}

export default function NumberField({
  value,
  defaultValue,
  onChange,
  placeholder,
  className,
  id,
  name,
  min,
  max,
  step = 1,
}: NumberFieldProps) {
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState<number | "">(defaultValue ?? "");
  const inputRef = useRef<HTMLInputElement | null>(null);

  const displayValue = isControlled ? value : internalValue;

  const emitChange = useCallback(
    (nextValue: number) => {
      const clamped = clamp(nextValue, min, max);
      if (!isControlled) {
        setInternalValue(clamped);
      }
      onChange?.(clamped);
    },
    [isControlled, max, min, onChange]
  );

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const raw = event.target.value.trim();
      if (raw === "") {
        if (!isControlled) {
          setInternalValue("");
        }
        return;
      }
      const parsed = Number(raw);
      if (!Number.isNaN(parsed)) {
        emitChange(parsed);
      }
    },
    [emitChange, isControlled]
  );

  const handleBlur = useCallback(() => {
    const current = isControlled ? value : internalValue;
    if (current === "" || current === undefined) {
      return;
    }
    emitChange(Number(current));
  }, [emitChange, internalValue, isControlled, value]);

  const handleStep = useCallback(
    (direction: 1 | -1) => {
      const currentDisplay = isControlled ? value : internalValue;
      const current =
        typeof currentDisplay === "number"
          ? currentDisplay
          : currentDisplay === ""
            ? min ?? 0
            : Number(currentDisplay);
      emitChange(current + direction * step);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    },
    [emitChange, internalValue, isControlled, min, step, value]
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
        className={cn(inputClassName, "pr-12", className)}
        ref={inputRef}
      />
      <div className="absolute right-1 top-1/2 -translate-y-1/2">
        <div className="flex flex-col gap-0 rounded-xl bg-transparent">
          <button
            type="button"
            onClick={() => handleStep(1)}
            className="bg-transparent px-2 py-0.5 text-[10px] font-semibold text-(--color-ink) leading-none hover:bg-[rgba(29,42,56,0.04)]"
            aria-label="Increase"
          >
            ▲
          </button>
          <button
            type="button"
            onClick={() => handleStep(-1)}
            className="bg-transparent px-2 py-0.5 text-[10px] font-semibold text-(--color-ink) leading-none hover:bg-[rgba(29,42,56,0.04)]"
            aria-label="Decrease"
          >
            ▼
          </button>
        </div>
      </div>
    </div>
  );
}

