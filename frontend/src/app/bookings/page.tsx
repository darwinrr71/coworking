"use client";

/* eslint-disable react-hooks/static-components, react-hooks/set-state-in-effect */

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import DateField from "@/components/ui/DateField";
import { apiFetch, getRooms } from "@/lib/api";
import { BookingInput } from "@/lib/validators";
import type { Room } from "@/lib/types";
import { z } from "zod";
import TimeField from "@/components/ui/TimeField";

type BookingResponse = Array<{
  id: number;
  roomId: number;
  userId: number;
  startTime: string;
  endTime: string;
  room?: { name: string; capacity: number };
  user?: { username: string };
}>;

type BookingMode = "ENKEL" | "PERIOD" | "VALDA_DATUM" | "ATERKOMMANDE";
type RecurrenceType = "WEEKLY" | "MONTHLY";

type Interval = {
  startAt: string;
  endAt: string;
};

type BookingDraft = {
  mode: BookingMode;
  recurrenceType: RecurrenceType;
  selectedDates: string[];
  selectedWeekdays: number[];
  monthDay: number;
  pendingDate: string;
  form: Partial<BookingFormInput>;
};

type AvailabilityResponse = {
  rooms: Array<{
    roomId: number;
    date: string;
    slots: Array<{
      startAt: string;
      endAt: string;
      status: "FREE" | "BUSY";
    }>;
  }>;
};

type ValidateResponse = {
  ok: boolean;
  conflicts: Array<{
    startAt: string;
    endAt: string;
    existingBookingId?: number;
  }>;
};

const WEEKDAYS = [
  { value: 1, label: "Mån" },
  { value: 2, label: "Tis" },
  { value: 3, label: "Ons" },
  { value: 4, label: "Tor" },
  { value: 5, label: "Fre" },
  { value: 6, label: "Lör" },
  { value: 0, label: "Sön" },
];

const BOOKING_DRAFT_STORAGE_KEY = "booking-form-draft-v1";

const requiredString = (message: string) =>
  z.preprocess(
    (value) => (typeof value === "string" ? value : ""),
    z.string().min(1, message),
  );

const requiredTime = (requiredMessage: string, formatMessage: string) =>
  z.preprocess(
    (value) => (typeof value === "string" ? value : ""),
    z
      .string()
      .min(1, requiredMessage)
      .refine(
        (value) => (value.length === 0 ? true : /^\d{2}$/.test(value)),
        formatMessage,
      )
      .refine((value) => {
        if (value.length === 0) return true;
        const hour = Number(value.slice(0, 2));
        return Number.isFinite(hour) && hour >= 8 && hour <= 22;
      }, "Tid måste vara mellan 08 och 22"),
  );

const bookingFormSchema = z
  .object({
    roomId: z.coerce.number().int().positive("Rum krävs"),
    startDate: requiredString("Startdatum krävs"),
    startTime: requiredTime("Starttid krävs", "Starttid måste vara HH"),
    endDate: requiredString("Slutdatum krävs"),
    endTime: requiredTime("Sluttid krävs", "Sluttid måste vara HH"),
  })
  .refine(
    (data) => {
      const start = new Date(`${data.startDate}T${data.startTime}:00`);
      const end = new Date(`${data.endDate}T${data.endTime}:00`);
      return end > start;
    },
    {
      message: "Sluttid måste vara efter starttid",
      path: ["endTime"],
    },
  );

type BookingFormInput = z.infer<typeof bookingFormSchema>;

const buildDayRange = (dateString: string) => {
  return {
    from: `${dateString}T00:00:00`,
    to: `${dateString}T23:59:59.999`,
  };
};

const uniqueSortedDates = (dates: string[]) =>
  Array.from(new Set(dates)).sort((a, b) => a.localeCompare(b));

const buildIntervals = (
  mode: BookingMode,
  values: BookingFormInput,
  selectedDates: string[],
  recurrenceType: RecurrenceType,
  selectedWeekdays: number[],
  monthDay: number,
): Interval[] => {
  const startAt = `${values.startDate}T${values.startTime}:00`;
  const endAt = `${values.endDate}T${values.endTime}:00`;

  if (mode === "ENKEL") {
    return [{ startAt, endAt }];
  }

  if (mode === "PERIOD") {
    const intervals: Interval[] = [];
    const cursor = new Date(`${values.startDate}T00:00:00`);
    const endDay = new Date(`${values.endDate}T00:00:00`);
    if (Number.isNaN(cursor.getTime()) || Number.isNaN(endDay.getTime())) {
      return [];
    }
    while (cursor.getTime() <= endDay.getTime()) {
      const dateKey = cursor.toISOString().slice(0, 10);
      intervals.push({
        startAt: `${dateKey}T${values.startTime}:00`,
        endAt: `${dateKey}T${values.endTime}:00`,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return intervals;
  }

  if (mode === "VALDA_DATUM") {
    return uniqueSortedDates(selectedDates).map((date) => ({
      startAt: `${date}T${values.startTime}:00`,
      endAt: `${date}T${values.endTime}:00`,
    }));
  }

  const intervals: Interval[] = [];
  const rangeStart = new Date(`${values.startDate}T00:00:00`);
  const rangeEnd = new Date(`${values.endDate}T00:00:00`);

  if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime())) {
    return [];
  }

  if (recurrenceType === "WEEKLY") {
    const cursor = new Date(rangeStart);
    cursor.setHours(0, 0, 0, 0);
    const endDay = new Date(rangeEnd);
    endDay.setHours(0, 0, 0, 0);

    while (cursor.getTime() <= endDay.getTime()) {
      if (selectedWeekdays.includes(cursor.getDay())) {
        const dateKey = cursor.toISOString().slice(0, 10);
        intervals.push({
          startAt: `${dateKey}T${values.startTime}:00`,
          endAt: `${dateKey}T${values.endTime}:00`,
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return intervals;
  }

  const monthCursor = new Date(
    rangeStart.getFullYear(),
    rangeStart.getMonth(),
    1,
  );
  const lastMonth = new Date(rangeEnd.getFullYear(), rangeEnd.getMonth(), 1);

  while (monthCursor.getTime() <= lastMonth.getTime()) {
    const candidate = new Date(
      monthCursor.getFullYear(),
      monthCursor.getMonth(),
      monthDay,
    );
    if (
      candidate.getMonth() === monthCursor.getMonth() &&
      candidate.getTime() >= rangeStart.getTime() &&
      candidate.getTime() <= rangeEnd.getTime()
    ) {
      const dateKey = candidate.toISOString().slice(0, 10);
      intervals.push({
        startAt: `${dateKey}T${values.startTime}:00`,
        endAt: `${dateKey}T${values.endTime}:00`,
      });
    }
    monthCursor.setMonth(monthCursor.getMonth() + 1);
  }

  return intervals;
};

export default function BookingsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
          <p className="text-sm text-(--color-stone)">Laddar bokningar...</p>
        </div>
      }
    >
      <BookingsPageClient />
    </Suspense>
  );
}

function BookingsPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const todayIso = new Date().toLocaleDateString("en-CA");
  const [mode, setMode] = useState<BookingMode>("ENKEL");
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [pendingDate, setPendingDate] = useState("");
  const [recurrenceType, setRecurrenceType] =
    useState<RecurrenceType>("WEEKLY");
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([
    1, 2, 3, 4, 5,
  ]);
  const [monthDay, setMonthDay] = useState(1);
  const [isDraftLoaded, setIsDraftLoaded] = useState(false);
  const [showDraftRestoredNotice, setShowDraftRestoredNotice] = useState(false);
  const [summary, setSummary] = useState<{
    intervals: Interval[];
    conflicts: ValidateResponse["conflicts"] | null;
  } | null>(null);
  const { data: me, isLoading: isLoadingMe } = useQuery({
    queryKey: ["me"],
    queryFn: () =>
      apiFetch<{ user: { username: string; role: string } }>("/api/me"),
    retry: false,
  });
  const isAuthenticated = !!me?.user;
  const isAdmin = me?.user?.role === "Admin";
  const { data, isLoading, error, refetch } = useQuery<BookingResponse>({
    queryKey: ["bookings"],
    queryFn: () => apiFetch<BookingResponse>("/api/booking/allbooking"),
    enabled: isAuthenticated,
  });
  const { data: rooms } = useQuery<Room[]>({
    queryKey: ["rooms"],
    queryFn: getRooms,
  });

  const mutation = useMutation({
    mutationFn: (payload: BookingInput) =>
      apiFetch("/api/booking/create", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      setShowDraftRestoredNotice(false);
      clearDraft();
      refetch();
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (bookingId: number) =>
      apiFetch(`/api/booking/delete/${bookingId}`, {
        method: "DELETE",
      }),
    onSuccess: () => refetch(),
  });

  const validateMutation = useMutation({
    mutationFn: (payload: { roomId: number; intervals: Interval[] }) =>
      apiFetch<ValidateResponse>("/api/bookings/validate", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (result, variables) => {
      setSummary((prev) => ({
        intervals: prev?.intervals ?? variables.intervals,
        conflicts: result.conflicts,
      }));
    },
  });

  const bulkMutation = useMutation({
    mutationFn: (payload: {
      roomId: number;
      intervals: Interval[];
      metadata?: Record<string, unknown>;
    }) =>
      apiFetch<{ createdCount: number; seriesId?: string }>(
        "/api/bookings/bulk",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      ),
    onSuccess: () => {
      setSummary(null);
      setShowDraftRestoredNotice(false);
      clearDraft();
      refetch();
    },
  });

  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<z.input<typeof bookingFormSchema>, unknown, BookingFormInput>({
    resolver: zodResolver(bookingFormSchema),
  });

  const watchedRoomId = useWatch({ control, name: "roomId" }) as
    | number
    | undefined;
  const watchedStartDate = useWatch({ control, name: "startDate" }) as
    | string
    | undefined;
  const watchedStartTime = useWatch({ control, name: "startTime" }) as
    | string
    | undefined;
  const watchedEndDate = useWatch({ control, name: "endDate" }) as
    | string
    | undefined;
  const watchedEndTime = useWatch({ control, name: "endTime" }) as
    | string
    | undefined;
  const endDateMin =
    watchedStartDate && watchedStartDate > todayIso
      ? watchedStartDate
      : todayIso;

  const requestedRoomId = useMemo(() => {
    const rawValue = searchParams.get("roomId");
    if (!rawValue) return undefined;
    const numericValue = Number(rawValue);
    if (!Number.isInteger(numericValue) || numericValue <= 0) return undefined;
    return numericValue;
  }, [searchParams]);

  const buildDraft = useCallback(
    (overrides?: Partial<BookingFormInput>): BookingDraft => {
      const formValues = getValues();
      const normalizedRoomId =
        typeof formValues.roomId === "number" &&
        Number.isFinite(formValues.roomId)
          ? formValues.roomId
          : undefined;
      const normalizedStartDate =
        typeof formValues.startDate === "string"
          ? formValues.startDate
          : undefined;
      const normalizedStartTime =
        typeof formValues.startTime === "string"
          ? formValues.startTime
          : undefined;
      const normalizedEndDate =
        typeof formValues.endDate === "string" ? formValues.endDate : undefined;
      const normalizedEndTime =
        typeof formValues.endTime === "string" ? formValues.endTime : undefined;
      const mergedValues: Partial<BookingFormInput> = {
        roomId: overrides?.roomId ?? normalizedRoomId,
        startDate: overrides?.startDate ?? normalizedStartDate,
        startTime: overrides?.startTime ?? normalizedStartTime,
        endDate: overrides?.endDate ?? normalizedEndDate,
        endTime: overrides?.endTime ?? normalizedEndTime,
      };

      return {
        mode,
        recurrenceType,
        selectedDates,
        selectedWeekdays,
        monthDay,
        pendingDate,
        form: mergedValues,
      };
    },
    [
      getValues,
      mode,
      recurrenceType,
      selectedDates,
      selectedWeekdays,
      monthDay,
      pendingDate,
    ],
  );

  const persistDraft = useCallback(
    (overrides?: Partial<BookingFormInput>) => {
      if (typeof window === "undefined") return;
      window.sessionStorage.setItem(
        BOOKING_DRAFT_STORAGE_KEY,
        JSON.stringify(buildDraft(overrides)),
      );
    },
    [buildDraft],
  );

  const clearDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.removeItem(BOOKING_DRAFT_STORAGE_KEY);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const rawDraft = window.sessionStorage.getItem(BOOKING_DRAFT_STORAGE_KEY);
    if (rawDraft) {
      try {
        const parsedDraft = JSON.parse(rawDraft) as BookingDraft;
        setShowDraftRestoredNotice(true);
        if (parsedDraft.mode) setMode(parsedDraft.mode);
        if (parsedDraft.recurrenceType)
          setRecurrenceType(parsedDraft.recurrenceType);
        if (Array.isArray(parsedDraft.selectedDates))
          setSelectedDates(parsedDraft.selectedDates);
        if (Array.isArray(parsedDraft.selectedWeekdays)) {
          setSelectedWeekdays(parsedDraft.selectedWeekdays);
        }
        if (typeof parsedDraft.monthDay === "number")
          setMonthDay(parsedDraft.monthDay);
        if (typeof parsedDraft.pendingDate === "string")
          setPendingDate(parsedDraft.pendingDate);
        if (parsedDraft.form?.roomId)
          setValue("roomId", Number(parsedDraft.form.roomId));
        if (parsedDraft.form?.startDate)
          setValue("startDate", String(parsedDraft.form.startDate));
        if (parsedDraft.form?.startTime)
          setValue("startTime", String(parsedDraft.form.startTime));
        if (parsedDraft.form?.endDate)
          setValue("endDate", String(parsedDraft.form.endDate));
        if (parsedDraft.form?.endTime)
          setValue("endTime", String(parsedDraft.form.endTime));
      } catch {
        window.sessionStorage.removeItem(BOOKING_DRAFT_STORAGE_KEY);
      }
    }

    if (requestedRoomId) {
      setValue("roomId", requestedRoomId);
    }

    setIsDraftLoaded(true);
  }, [requestedRoomId, setValue]);

  useEffect(() => {
    if (!isDraftLoaded) return;
    persistDraft();
  }, [
    isDraftLoaded,
    mode,
    recurrenceType,
    selectedDates,
    selectedWeekdays,
    monthDay,
    pendingDate,
    watchedRoomId,
    watchedStartDate,
    watchedStartTime,
    watchedEndDate,
    watchedEndTime,
    persistDraft,
  ]);

  useEffect(() => {
    setSummary(null);
  }, [
    mode,
    selectedDates,
    recurrenceType,
    selectedWeekdays,
    monthDay,
    watchedRoomId,
    watchedStartDate,
    watchedStartTime,
    watchedEndDate,
    watchedEndTime,
  ]);

  const availabilityDate = useMemo(() => {
    if (mode === "VALDA_DATUM" && selectedDates.length > 0) {
      return selectedDates[0];
    }
    return watchedStartDate;
  }, [mode, selectedDates, watchedStartDate]);

  const availabilityQuery = useQuery({
    queryKey: ["availability", watchedRoomId, availabilityDate],
    queryFn: () => {
      if (!availabilityDate) {
        throw new Error("Datum saknas");
      }
      const { from, to } = buildDayRange(availabilityDate);
      const params = new URLSearchParams({
        from,
        to,
        roomIds: String(watchedRoomId),
        slotMinutes: "60",
      });
      return apiFetch<AvailabilityResponse>(
        `/api/availability?${params.toString()}`,
      );
    },
    enabled: isAuthenticated && !!watchedRoomId && !!availabilityDate,
  });

  const availabilitySlots = useMemo(() => {
    if (!availabilityQuery.data || !availabilityDate || !watchedRoomId) {
      return [];
    }
    return availabilityQuery.data.rooms
      .filter((room) => room.roomId === Number(watchedRoomId))
      .flatMap((room) =>
        room.slots.filter((slot) => {
          const slotDate = new Date(slot.startAt);
          const slotDateKey = [
            String(slotDate.getFullYear()),
            String(slotDate.getMonth() + 1).padStart(2, "0"),
            String(slotDate.getDate()).padStart(2, "0"),
          ].join("-");
          return slotDateKey === availabilityDate;
        }),
      );
  }, [availabilityQuery.data, availabilityDate, watchedRoomId]);

  const InlineHint = ({ message }: { message?: string }) => (
    <p className="mt-2 text-xs text-(--color-stone)">{message}</p>
  );

  if (isLoadingMe) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <p className="text-sm text-(--color-stone)">Laddar...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,0.84fr)_minmax(0,1.16fr)] xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="glass-panel min-w-0 rounded-[32px] p-6 sm:p-8">
          <h1 className="text-3xl font-semibold text-(--color-deep)">
            Skapa bokning
          </h1>
          <p className="mt-2 text-sm text-(--color-forest)">
            Endast tillgängliga tider accepteras.
          </p>
          {isAuthenticated && showDraftRestoredNotice && (
            <div className="mt-4 flex items-start justify-between gap-3 rounded-2xl border border-[rgba(29,42,56,0.14)] bg-white/80 px-4 py-3">
              <p className="text-xs text-(--color-forest)">
                Formuläret återställdes från din senaste session.
              </p>
              <button
                type="button"
                onClick={() => setShowDraftRestoredNotice(false)}
                className="text-xs font-semibold uppercase tracking-[0.14em] text-(--color-stone) transition hover:text-(--color-ink)"
              >
                Stäng
              </button>
            </div>
          )}
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-(--color-stone)">
            Välj bokningstyp
          </p>
          <div className="mt-2 mb-1 rounded-3xl bg-white/70 p-2 shadow-[0_10px_30px_rgba(29,42,56,0.08)]">
            <div className="grid grid-cols-2 gap-2">
              {[
                { value: "ENKEL", label: "Enkel" },
                { value: "PERIOD", label: "Period" },
                { value: "VALDA_DATUM", label: "Valda datum" },
                { value: "ATERKOMMANDE", label: "Återkommande" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setMode(option.value as BookingMode)}
                  className={`w-full whitespace-nowrap rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-center transition ${
                    mode === option.value
                      ? "bg-(--color-forest) text-white shadow-[0_10px_30px_rgba(29,42,56,0.18)]"
                      : "bg-white/80 text-(--color-ink)"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <form
            className="mt-6 space-y-4"
            onSubmit={handleSubmit((data) => {
              if (mode === "ENKEL") {
                if (!isAuthenticated) {
                  persistDraft(data);
                  router.push("/login?redirect=/bookings");
                  return;
                }
                const payload: BookingInput = {
                  roomId: data.roomId,
                  startTime: `${data.startDate}T${data.startTime}:00`,
                  endTime: `${data.endDate}T${data.endTime}:00`,
                };
                mutation.mutate(payload);
                return;
              }

              const intervals = buildIntervals(
                mode,
                data,
                selectedDates,
                recurrenceType,
                selectedWeekdays,
                monthDay,
              );

              setSummary({ intervals, conflicts: null });

              if (intervals.length === 0) {
                return;
              }

              validateMutation.mutate({
                roomId: data.roomId,
                intervals,
              });
            })}
          >
            <div className="min-w-0">
              <label className="mb-2 inline-flex text-xs font-semibold uppercase tracking-[0.2em] text-(--color-stone)">
                Rum<span className="text-(--color-gold)">*</span>
              </label>
              <select
                className="w-full rounded-2xl border border-[rgba(29,42,56,0.12)] bg-white/80 px-4 py-3 text-sm text-(--color-ink) shadow-[0_10px_30px_rgba(29,42,56,0.08)] outline-none transition focus:border-(--color-gold)"
                defaultValue=""
                {...register("roomId")}
              >
                <option value="" disabled>
                  Välj rummmmmmmm
                </option>
                {rooms?.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name} (Kapacitet {room.capacity})
                  </option>
                ))}
              </select>
              {errors.roomId && (
                <InlineHint message={errors.roomId.message ?? ""} />
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_130px]">
              <div className="min-w-0">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-(--color-stone)">
                  Startdatum<span className="text-(--color-gold)">*</span>
                </label>
                <Controller
                  control={control}
                  name="startDate"
                  render={({ field }) => (
                    <DateField
                      className="mt-2"
                      value={field.value as string | undefined}
                      onChange={field.onChange}
                      min={todayIso}
                    />
                  )}
                />
                {errors.startDate && (
                  <InlineHint message={errors.startDate.message ?? ""} />
                )}
              </div>
              <div className="min-w-0">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-(--color-stone)">
                  Starttid<span className="text-(--color-gold)">*</span>
                </label>
                <div className="mt-2">
                  <Controller
                    control={control}
                    name="startTime"
                    render={({ field }) => (
                      <TimeField
                        value={field.value as string | undefined}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </div>
                {errors.startTime && (
                  <InlineHint message={errors.startTime.message ?? ""} />
                )}
              </div>
              <div className="min-w-0">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-(--color-stone)">
                  Slutdatum<span className="text-(--color-gold)">*</span>
                </label>
                <Controller
                  control={control}
                  name="endDate"
                  render={({ field }) => (
                    <DateField
                      className="mt-2"
                      value={field.value as string | undefined}
                      onChange={field.onChange}
                      min={endDateMin}
                    />
                  )}
                />
                {errors.endDate && (
                  <InlineHint message={errors.endDate.message ?? ""} />
                )}
              </div>
              <div className="min-w-0">
                <label className="text-xs font-semibold uppercase tracking-[0.2em] text-(--color-stone)">
                  Sluttid<span className="text-(--color-gold)">*</span>
                </label>
                <div className="mt-2">
                  <Controller
                    control={control}
                    name="endTime"
                    render={({ field }) => (
                      <TimeField
                        value={field.value as string | undefined}
                        onChange={field.onChange}
                      />
                    )}
                  />
                </div>
                {errors.endTime && (
                  <InlineHint message={errors.endTime.message ?? ""} />
                )}
              </div>
            </div>

            {mode === "VALDA_DATUM" && (
              <div className="rounded-3xl border border-[rgba(29,42,56,0.12)] bg-white/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-(--color-stone)">
                  Valda datum
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <DateField
                    className="max-w-[220px]"
                    value={pendingDate}
                    onChange={setPendingDate}
                    min={todayIso}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      if (!pendingDate) return;
                      setSelectedDates((prev) =>
                        uniqueSortedDates([...prev, pendingDate]),
                      );
                      setPendingDate("");
                    }}
                  >
                    Lägg till datum
                  </Button>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedDates.length === 0 && (
                    <span className="text-xs text-(--color-stone)">
                      Inga datum valda ännu.
                    </span>
                  )}
                  {selectedDates.map((date) => (
                    <button
                      key={date}
                      type="button"
                      onClick={() =>
                        setSelectedDates((prev) =>
                          prev.filter((item) => item !== date),
                        )
                      }
                      className="rounded-full border border-[rgba(29,42,56,0.12)] bg-white px-3 py-1 text-xs text-(--color-ink) shadow-[0_6px_20px_rgba(29,42,56,0.08)]"
                    >
                      {new Date(date).toLocaleDateString("sv-SE", {
                        year: "numeric",
                        month: "short",
                        day: "2-digit",
                      })}{" "}
                      ✕
                    </button>
                  ))}
                </div>
                <InlineHint message="Alla valda datum använder samma start- och sluttid." />
              </div>
            )}

            {mode === "ATERKOMMANDE" && (
              <div className="rounded-3xl border border-[rgba(29,42,56,0.12)] bg-white/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-(--color-stone)">
                  Återkommande regel
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[
                    { value: "WEEKLY", label: "Veckovis" },
                    { value: "MONTHLY", label: "Månadsvis" },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setRecurrenceType(option.value as RecurrenceType)
                      }
                      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                        recurrenceType === option.value
                          ? "bg-(--color-deep) text-white"
                          : "bg-white/80 text-(--color-ink)"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {recurrenceType === "WEEKLY" && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {WEEKDAYS.map((day) => {
                      const active = selectedWeekdays.includes(day.value);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() =>
                            setSelectedWeekdays((prev) =>
                              active
                                ? prev.filter((value) => value !== day.value)
                                : [...prev, day.value],
                            )
                          }
                          className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] transition ${
                            active
                              ? "bg-(--color-forest) text-white"
                              : "bg-white/80 text-(--color-ink)"
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                )}

                {recurrenceType === "MONTHLY" && (
                  <div className="mt-4 flex items-center gap-3">
                    <label className="text-xs font-semibold uppercase tracking-[0.2em] text-(--color-stone)">
                      Dag i månaden
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      value={monthDay}
                      onChange={(event) => {
                        const value = Number(event.target.value);
                        if (Number.isFinite(value)) {
                          setMonthDay(Math.min(31, Math.max(1, value)));
                        }
                      }}
                      className="max-w-[120px]"
                    />
                  </div>
                )}
                <InlineHint message="Gäller inom datumintervallet ovan." />
              </div>
            )}

            {watchedRoomId && availabilityDate && (
              <div className="rounded-3xl border border-[rgba(29,42,56,0.12)] bg-white/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-(--color-stone)">
                  Tillgänglighet{" "}
                  {availabilityDate
                    ? new Date(availabilityDate).toLocaleDateString("sv-SE", {
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                      })
                    : ""}
                </p>
                {availabilityQuery.isLoading && (
                  <p className="mt-3 text-xs text-(--color-stone)">
                    Hämtar tider...
                  </p>
                )}
                {availabilityQuery.isError && (
                  <p className="mt-3 text-xs text-red-500">
                    {(availabilityQuery.error as Error).message}
                  </p>
                )}
                {!availabilityQuery.isLoading &&
                  availabilitySlots.length === 0 && (
                    <p className="mt-3 text-xs text-(--color-stone)">
                      Inga slotar tillgängliga.
                    </p>
                  )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {availabilitySlots.map((slot) => (
                    <span
                      key={`${slot.startAt}-${slot.endAt}`}
                      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em] ${
                        slot.status === "FREE"
                          ? "bg-(--color-forest) text-white"
                          : "bg-white/80 text-(--color-stone)"
                      }`}
                    >
                      {new Date(slot.startAt).toLocaleTimeString("sv-SE", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <Button
              type="submit"
              disabled={mutation.isPending || validateMutation.isPending}
              className="w-full"
            >
              {mode === "ENKEL"
                ? mutation.isPending
                  ? "Bokar..."
                  : "Boka rum"
                : validateMutation.isPending
                  ? "Kontrollerar..."
                  : "Förhandsgranska"}
            </Button>
            {!isAuthenticated && (
              <InlineHint message="Du kan fylla i formuläret nu. Inloggning krävs först när du skickar bokningen." />
            )}
          </form>
          {summary &&
            (mode === "PERIOD" ||
              mode === "VALDA_DATUM" ||
              mode === "ATERKOMMANDE") && (
              <div className="mt-6 rounded-3xl border border-[rgba(29,42,56,0.12)] bg-white/70 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-(--color-stone)">
                  Sammanfattning
                </p>
                <p className="mt-2 text-sm text-(--color-forest)">
                  {summary.intervals.length} bokning(ar) planerade.
                </p>
                <div className="mt-3 space-y-1 text-xs text-(--color-ink)">
                  {summary.intervals.slice(0, 6).map((interval) => (
                    <p key={`${interval.startAt}-${interval.endAt}`}>
                      {new Date(interval.startAt).toLocaleDateString("sv-SE", {
                        year: "numeric",
                        month: "short",
                        day: "2-digit",
                      })}{" "}
                      {new Date(interval.startAt).toLocaleTimeString("sv-SE", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      –{" "}
                      {new Date(interval.endAt).toLocaleTimeString("sv-SE", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  ))}
                  {summary.intervals.length > 6 && (
                    <p className="text-(--color-stone)">
                      +{summary.intervals.length - 6} till
                    </p>
                  )}
                </div>
                {summary.conflicts && summary.conflicts.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-xs text-red-600">
                    <p className="font-semibold uppercase tracking-[0.2em]">
                      Konflikter
                    </p>
                    {summary.conflicts.map((conflict) => (
                      <p key={`${conflict.startAt}-${conflict.endAt}`}>
                        {new Date(conflict.startAt).toLocaleDateString("sv-SE")}{" "}
                        {new Date(conflict.startAt).toLocaleTimeString(
                          "sv-SE",
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}{" "}
                        –{" "}
                        {new Date(conflict.endAt).toLocaleTimeString("sv-SE", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    ))}
                  </div>
                )}
                <Button
                  type="button"
                  className="mt-4 w-full"
                  disabled={
                    bulkMutation.isPending ||
                    !summary.conflicts ||
                    summary.conflicts.length > 0 ||
                    summary.intervals.length === 0
                  }
                  onClick={() => {
                    if (!summary) return;
                    if (!isAuthenticated) {
                      persistDraft();
                      router.push("/login?redirect=/bookings");
                      return;
                    }
                    bulkMutation.mutate({
                      roomId: Number(watchedRoomId),
                      intervals: summary.intervals,
                      metadata: {
                        mode,
                        recurrenceType:
                          mode === "ATERKOMMANDE" ? recurrenceType : undefined,
                        selectedDates:
                          mode === "VALDA_DATUM"
                            ? uniqueSortedDates(selectedDates)
                            : undefined,
                        selectedWeekdays:
                          mode === "ATERKOMMANDE" && recurrenceType === "WEEKLY"
                            ? selectedWeekdays
                            : undefined,
                        monthDay:
                          mode === "ATERKOMMANDE" &&
                          recurrenceType === "MONTHLY"
                            ? monthDay
                            : undefined,
                      },
                    });
                  }}
                >
                  {bulkMutation.isPending ? "Skapar..." : "Bekräfta bokningar"}
                </Button>
                {bulkMutation.isError && (
                  <p className="mt-3 text-xs text-red-500">
                    {(bulkMutation.error as Error).message}
                  </p>
                )}
              </div>
            )}
          {validateMutation.isError && (
            <p className="mt-4 text-sm text-red-500">
              {(validateMutation.error as Error).message}
            </p>
          )}
          {mutation.isError && (
            <p className="mt-4 text-sm text-red-500">
              {mutation.error.message}
            </p>
          )}
          {mutation.isSuccess && (
            <p className="mt-4 text-sm text-(--color-forest)">
              Bokningen är skapad.
            </p>
          )}
        </div>

        <div className="min-w-0">
          <h2 className="text-2xl font-semibold text-(--color-deep)">
            {isAdmin ? "Alla bokningar" : "Dina bokningar"}
          </h2>
          {isLoading && (
            <p className="mt-6 text-sm text-(--color-stone)">Laddar...</p>
          )}
          {error && (
            <p className="mt-6 text-sm text-red-500">
              {(error as Error).message}
            </p>
          )}
          <div className="mt-6 min-w-0 overflow-hidden rounded-3xl border border-[rgba(29,42,56,0.1)] bg-white/70">
            <div className="space-y-3 p-3 lg:hidden">
              {data && data.length > 0 ? (
                data.map((booking) => (
                  <article
                    key={booking.id}
                    className="rounded-2xl border border-[rgba(29,42,56,0.1)] bg-white/80 p-3 shadow-[0_6px_20px_rgba(29,42,56,0.06)]"
                  >
                    <p className="text-[10px] uppercase tracking-[0.14em] text-(--color-gold)">
                      {booking.room?.name ?? "Rum"}
                    </p>
                    <div className="mt-2 grid grid-cols-[72px_1fr] gap-y-1 text-[10px]">
                      {isAdmin && (
                        <>
                          <span className="uppercase tracking-[0.16em] text-(--color-stone)">
                            Användare
                          </span>
                          <span className="text-(--color-deep)">
                            {booking.user?.username ?? "-"}
                          </span>
                        </>
                      )}
                      <span className="uppercase tracking-[0.16em] text-(--color-stone)">
                        Datum
                      </span>
                      <span className="text-(--color-deep)">
                        {new Date(booking.startTime).toLocaleDateString(
                          "sv-SE",
                          {
                            year: "numeric",
                            month: "short",
                            day: "2-digit",
                          },
                        )}
                      </span>
                      <span className="uppercase tracking-[0.16em] text-(--color-stone)">
                        Tid
                      </span>
                      <span className="text-(--color-stone)">
                        {new Date(booking.startTime).toLocaleTimeString(
                          "sv-SE",
                          {
                            hour: "2-digit",
                            minute: "2-digit",
                          },
                        )}{" "}
                        –{" "}
                        {new Date(booking.endTime).toLocaleTimeString("sv-SE", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        className="px-2 py-2 text-[10px]"
                        onClick={() =>
                          router.push(`/bookings/${booking.id}/edit`)
                        }
                      >
                        Redigera
                      </Button>
                      <Button
                        variant="outline"
                        className="px-2 py-2 text-[10px]"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          if (window.confirm("Vill du ta bort bokningen?")) {
                            deleteMutation.mutate(booking.id);
                          }
                        }}
                      >
                        {deleteMutation.isPending ? "Tar bort..." : "Ta bort"}
                      </Button>
                    </div>
                  </article>
                ))
              ) : (
                <p className="px-2 py-8 text-center text-sm text-(--color-stone)">
                  Inga bokningar ännu.
                </p>
              )}
            </div>

            <div className="hidden lg:block">
              <div className="overflow-x-auto">
                <div className="max-h-none overflow-y-visible lg:max-h-[560px] lg:overflow-y-auto">
                  <table className="w-full min-w-0 border-separate border-spacing-0">
                    <thead>
                      <tr>
                        <th className="sticky top-0 z-10 bg-[rgba(230,236,242,0.94)] px-3 py-4 text-left text-[10px] sm:px-4 font-semibold uppercase tracking-[0.2em] text-(--color-stone) backdrop-blur">
                          Rum
                        </th>
                        {isAdmin && (
                          <th className="sticky top-0 z-10 bg-[rgba(230,236,242,0.94)] px-3 py-4 text-left text-[10px] sm:px-4 font-semibold uppercase tracking-[0.2em] text-(--color-stone) backdrop-blur">
                            Användare
                          </th>
                        )}
                        <th className="sticky top-0 z-10 bg-[rgba(230,236,242,0.94)] px-3 py-4 text-left text-[10px] sm:px-4 font-semibold uppercase tracking-[0.2em] text-(--color-stone) backdrop-blur">
                          Datum
                        </th>
                        <th className="sticky top-0 z-10 bg-[rgba(230,236,242,0.94)] px-3 py-4 text-left text-[10px] sm:px-4 font-semibold uppercase tracking-[0.2em] text-(--color-stone) backdrop-blur">
                          Tid
                        </th>
                        <th className="sticky top-0 z-10 bg-[rgba(230,236,242,0.94)] px-3 py-4 text-right text-[10px] sm:px-4 font-semibold uppercase tracking-[0.2em] text-(--color-stone) backdrop-blur">
                          Åtgärder
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data && data.length > 0 ? (
                        data.map((booking) => (
                          <tr
                            key={booking.id}
                            className="border-b border-[rgba(29,42,56,0.08)] transition hover:bg-[rgba(255,255,255,0.45)]"
                          >
                            <td className="px-3 py-4 text-[10px] uppercase tracking-[0.12em] text-(--color-gold) sm:px-4 break-words">
                              {booking.room?.name ?? "Rum"}
                            </td>
                            {isAdmin && (
                              <td className="px-3 py-4 text-[10px] uppercase tracking-[0.14em] text-(--color-stone) sm:px-4">
                                {booking.user?.username ?? "-"}
                              </td>
                            )}
                            <td className="px-3 py-4 text-[10px] font-medium text-(--color-deep) sm:px-4">
                              {new Date(booking.startTime).toLocaleDateString(
                                "sv-SE",
                                {
                                  year: "numeric",
                                  month: "short",
                                  day: "2-digit",
                                },
                              )}
                            </td>
                            <td className="px-3 py-4 text-[10px] uppercase tracking-[0.08em] text-(--color-stone) sm:px-4 whitespace-nowrap">
                              {new Date(booking.startTime).toLocaleTimeString(
                                "sv-SE",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}{" "}
                              –{" "}
                              {new Date(booking.endTime).toLocaleTimeString(
                                "sv-SE",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                            </td>
                            <td className="px-3 py-4 sm:px-4">
                              <div className="flex items-center justify-end gap-2">
                                <Button
                                  variant="outline"
                                  className="px-2.5 py-2 text-[10px]"
                                  onClick={() =>
                                    router.push(`/bookings/${booking.id}/edit`)
                                  }
                                >
                                  Redigera
                                </Button>
                                <Button
                                  variant="outline"
                                  className="px-2.5 py-2 text-[10px]"
                                  disabled={deleteMutation.isPending}
                                  onClick={() => {
                                    if (
                                      window.confirm(
                                        "Vill du ta bort bokningen?",
                                      )
                                    ) {
                                      deleteMutation.mutate(booking.id);
                                    }
                                  }}
                                >
                                  {deleteMutation.isPending
                                    ? "Tar bort..."
                                    : "Ta bort"}
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={isAdmin ? 5 : 4}
                            className="px-4 py-10 text-center text-sm text-(--color-stone) sm:px-5"
                          >
                            Inga bokningar ännu.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
