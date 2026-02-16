"use client";

/* eslint-disable react-hooks/static-components */

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Button from "@/components/ui/Button";
import TimeField from "@/components/ui/TimeField";
import DateField from "@/components/ui/DateField";
import { apiFetch } from "@/lib/api";

type BookingResponse = Array<{
  id: number;
  roomId: number;
  userId: number;
  startTime: string;
  endTime: string;
  room?: { name: string; capacity: number };
  user?: { username: string };
}>;

const requiredString = (message: string) =>
  z.preprocess(
    (value) => (typeof value === "string" ? value : ""),
    z.string().min(1, message)
  );

const requiredTime = (requiredMessage: string, formatMessage: string) =>
  z.preprocess(
    (value) => (typeof value === "string" ? value : ""),
    z
      .string()
      .min(1, requiredMessage)
      .refine((value) => (value.length === 0 ? true : /^\d{2}$/.test(value)), formatMessage)
      .refine((value) => {
        if (value.length === 0) return true;
        const hour = Number(value.slice(0, 2));
        return Number.isFinite(hour) && hour >= 8 && hour <= 22;
      }, "Tid måste vara mellan 08 och 22")
  );

const bookingFormSchema = z
  .object({
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
    }
  );

type BookingFormInput = z.infer<typeof bookingFormSchema>;

export default function BookingEditPage() {
  const params = useParams();
  const router = useRouter();
  const todayIso = new Date().toLocaleDateString("en-CA");
  const bookingId = Number(params.id);

  const { data: me, isLoading: isLoadingMe } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<{ user: { username: string; role: string } }>("/api/me"),
    retry: false,
  });
  const isAuthenticated = !!me?.user;

  const { data, isLoading, error } = useQuery<BookingResponse>({
    queryKey: ["bookings"],
    queryFn: () => apiFetch<BookingResponse>("/api/booking/allbooking"),
    enabled: isAuthenticated,
  });

  const booking = data?.find((item) => item.id === bookingId);

  const mutation = useMutation({
    mutationFn: (payload: { startTime: string; endTime: string }) =>
      apiFetch(`/api/booking/update/${bookingId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => router.push("/bookings"),
  });

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<z.input<typeof bookingFormSchema>, unknown, BookingFormInput>({
    resolver: zodResolver(bookingFormSchema),
  });
  const watchedStartDate = useWatch({ control, name: "startDate" }) as string | undefined;
  const endDateMin = watchedStartDate && watchedStartDate > todayIso ? watchedStartDate : todayIso;

  const InlineHint = ({ message }: { message?: string }) => (
    <p className="mt-2 text-xs text-(--color-stone)">{message}</p>
  );

  useEffect(() => {
    if (booking) {
      const start = new Date(booking.startTime);
      const end = new Date(booking.endTime);
      const pad = (value: number) => String(value).padStart(2, "0");
      reset({
        startDate: start.toISOString().slice(0, 10),
        startTime: `${pad(start.getHours())}`,
        endDate: end.toISOString().slice(0, 10),
        endTime: `${pad(end.getHours())}`,
      });
    }
  }, [booking, reset]);

  if (isLoadingMe) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-16 sm:px-6">
        <p className="text-sm text-(--color-stone)">Laddar...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-16 sm:px-6">
        <p className="text-sm text-red-500">Logga in för att redigera bokningar.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-16 sm:px-6">
        <p className="text-sm text-red-500">{(error as Error).message}</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-16 sm:px-6">
        <p className="text-sm text-(--color-stone)">Hämtar bokning...</p>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-16 sm:px-6">
        <p className="text-sm text-(--color-stone)">Bokningen hittades inte.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-16 sm:px-6">
      <div className="glass-panel rounded-[32px] p-8">
        <h1 className="text-3xl font-semibold text-(--color-deep)">
          Redigera bokning
        </h1>
        {booking.room?.name && (
          <p className="mt-2 text-sm text-(--color-forest)">
            Rum: {booking.room.name}
          </p>
        )}
        <form
          className="mt-8 space-y-4"
          onSubmit={handleSubmit((data) => {
            mutation.mutate({
              startTime: `${data.startDate}T${data.startTime}:00`,
              endTime: `${data.endDate}T${data.endTime}:00`,
            });
          })}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
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
              {errors.startDate && <InlineHint message={errors.startDate.message ?? ""} />}
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-(--color-stone)">
                Starttid<span className="text-(--color-gold)">*</span>
              </label>
              <div className="mt-2">
                <Controller
                  control={control}
                  name="startTime"
                  render={({ field }) => (
                    <TimeField value={field.value as string | undefined} onChange={field.onChange} />
                  )}
                />
              </div>
              {errors.startTime && <InlineHint message={errors.startTime.message ?? ""} />}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
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
              {errors.endDate && <InlineHint message={errors.endDate.message ?? ""} />}
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-(--color-stone)">
                Sluttid<span className="text-(--color-gold)">*</span>
              </label>
              <div className="mt-2">
                <Controller
                  control={control}
                  name="endTime"
                  render={({ field }) => (
                    <TimeField value={field.value as string | undefined} onChange={field.onChange} />
                  )}
                />
              </div>
              {errors.endTime && <InlineHint message={errors.endTime.message ?? ""} />}
            </div>
          </div>
          <Button type="submit" disabled={mutation.isPending} className="w-full">
            {mutation.isPending ? "Sparar..." : "Spara ändringar"}
          </Button>
        </form>
        {mutation.isError && (
          <p className="mt-4 text-sm text-red-500">{mutation.error.message}</p>
        )}
      </div>
    </div>
  );
}








