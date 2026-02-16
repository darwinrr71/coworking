"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type DateFieldProps = {
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
  name?: string;
  min?: string;
  max?: string;
};

type DateInputWithPicker = HTMLInputElement & {
  showPicker?: () => void;
};

const inputClassName =
  "w-full rounded-2xl border border-[rgba(29,42,56,0.12)] bg-white/80 px-4 py-3 text-sm text-(--color-ink) shadow-[0_10px_30px_rgba(29,42,56,0.08)] outline-none transition focus:border-(--color-gold)";

function formatDateInput(value: string) {
  if (!value) return "";
  const [yyyy, mm, dd] = value.split("-");
  if (!yyyy || !mm || !dd) return value;
  return `${dd}/${mm}/${yyyy}`;
}

function parseDateInput(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  const iso = `${yyyy}-${mm}-${dd}`;
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  return iso;
}

function isWithinRange(value: string, min?: string, max?: string) {
  if (!value) return true;
  if (min && value < min) return false;
  if (max && value > max) return false;
  return true;
}

function getRangeError(value: string, min?: string, max?: string) {
  if (!value) return null;
  if (min && value < min) {
    return "Datum kan inte vara tidigare än tillåtet startdatum.";
  }
  if (max && value > max) {
    return "Datum kan inte vara senare än tillåtet slutdatum.";
  }
  return null;
}

export default function DateField({
  value,
  defaultValue = "",
  onChange,
  placeholder = "DD/MM/ÅÅÅÅ",
  className,
  id,
  name,
  min,
  max,
}: DateFieldProps) {
  const isControlled = value !== undefined;
  const [internalDisplayValue, setInternalDisplayValue] = useState(
    formatDateInput(defaultValue)
  );
  const [rangeError, setRangeError] = useState<string | null>(null);
  const dateRef = useRef<HTMLInputElement | null>(null);

  const displayValue = isControlled
    ? formatDateInput(value ?? "")
    : internalDisplayValue;

  const isoValue = useMemo(() => value ?? defaultValue ?? "", [defaultValue, value]);

  const emitChange = useCallback(
    (nextValue: string) => {
      onChange?.(nextValue);
    },
    [onChange]
  );

  const handleTextChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const next = event.target.value;
      if (!isControlled) {
        setInternalDisplayValue(next);
      }
      if (next.trim() === "") {
        setRangeError(null);
        emitChange("");
        return;
      }
      const parsed = parseDateInput(next);
      if (!parsed) {
        return;
      }
      if (isWithinRange(parsed, min, max)) {
        setRangeError(null);
        emitChange(parsed);
        return;
      }
      setRangeError(getRangeError(parsed, min, max));
    },
    [emitChange, isControlled, max, min]
  );

  const handleDateChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextIso = event.target.value;
      if (!nextIso) {
        if (!isControlled) {
          setInternalDisplayValue("");
        }
        setRangeError(null);
        emitChange("");
        return;
      }
      if (!isWithinRange(nextIso, min, max)) {
        setRangeError(getRangeError(nextIso, min, max));
        return;
      }
      setRangeError(null);
      if (!isControlled) {
        setInternalDisplayValue(formatDateInput(nextIso));
      }
      emitChange(nextIso);
    },
    [emitChange, isControlled, max, min]
  );

  const handlePicker = useCallback(() => {
    const input = dateRef.current as DateInputWithPicker | null;
    if (!input) return;
    if (typeof input.showPicker === "function") {
      input.showPicker();
      return;
    }
    input.focus();
  }, []);

  return (
    <div className={cn("relative", className)}>
      <input
        id={id}
        name={name}
        value={displayValue}
        onChange={handleTextChange}
        placeholder={placeholder}
        inputMode="numeric"
        className={cn(inputClassName, "pr-12")}
        aria-label="DD/MM/ÅÅÅÅ"
      />
      <button
        type="button"
        onClick={handlePicker}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-(--color-ink) hover:bg-[rgba(29,42,56,0.06)]"
        aria-label="Öppna kalender"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="h-5 w-5"
        >
          <path d="M8 2v4M16 2v4M3.5 9h17M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v12a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V7A1.5 1.5 0 0 1 5 5.5z" />
        </svg>
      </button>
      <input
        ref={dateRef}
        type="date"
        value={isoValue}
        onChange={handleDateChange}
        min={min}
        max={max}
        className="pointer-events-none absolute inset-0 opacity-0"
        tabIndex={-1}
        aria-hidden
      />
      {rangeError && <p className="mt-2 text-xs text-red-500">{rangeError}</p>}
    </div>
  );
}

