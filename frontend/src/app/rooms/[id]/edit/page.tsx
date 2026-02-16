"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import { apiFetch, getRooms } from "@/lib/api";
import { Room } from "@/lib/types";
import { RoomInput, roomSchema } from "@/lib/validators";
import { z } from "zod";

type RoomFormInput = z.input<typeof roomSchema>;

export default function RoomEditPage() {
  const params = useParams();
  const roomId = Number(params.id);

  const { data: me, isLoading: isLoadingMe } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<{ user: { username: string; role: string } }>("/api/me"),
    retry: false,
  });
  const { data } = useQuery<Room[]>({
    queryKey: ["rooms"],
    queryFn: getRooms,
  });

  const room = data?.find((item) => item.id === roomId);

  const mutation = useMutation({
    mutationFn: (payload: RoomInput) =>
      apiFetch(`/api/room/update/${roomId}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RoomFormInput, unknown, RoomInput>({
    resolver: zodResolver(roomSchema),
  });

  useEffect(() => {
    if (room) {
      reset({
        name: room.name,
        address: room.address,
        capacity: room.capacity,
        pricePerHour: room.pricePerHour,
        squareMeters: room.squareMeters,
        description: room.description,
        type: room.type,
      });
    }
  }, [room, reset]);

  if (isLoadingMe) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-16 sm:px-6">
        <p className="text-sm text-(--color-stone)">Laddar...</p>
      </div>
    );
  }

  if (me?.user?.role !== "Admin") {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-16 sm:px-6">
        <p className="text-sm text-red-500">Du saknar behörighet för att redigera rum.</p>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="mx-auto w-full max-w-xl px-4 py-16 sm:px-6">
        <p className="text-sm text-(--color-stone)">Hämtar rum...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-16 sm:px-6">
      <div className="glass-panel rounded-[32px] p-8">
        <h1 className="text-3xl font-semibold text-(--color-deep)">Redigera rum</h1>
        <form
          className="mt-8 space-y-4"
          onSubmit={handleSubmit((data) => mutation.mutate(data))}
        >
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-(--color-stone)">
              Namn <span className="text-(--color-gold)">*</span>
            </label>
            <Input placeholder="Namn" {...register("name")} />
            {errors.name && (
              <p className="mt-2 text-xs text-(--color-stone)">{errors.name.message}</p>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-(--color-stone)">
              Adress <span className="text-(--color-gold)">*</span>
            </label>
            <Input placeholder="Adress" {...register("address")} />
            {errors.address && (
              <p className="mt-2 text-xs text-(--color-stone)">
                {errors.address.message}
              </p>
            )}
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-(--color-stone)">
                Kapacitet <span className="text-(--color-gold)">*</span>
              </label>
              <Input
                type="number"
                placeholder="Kapacitet"
                {...register("capacity", {
                  setValueAs: (value) => (value === "" ? undefined : Number(value)),
                })}
              />
              {errors.capacity && (
                <p className="mt-2 text-xs text-(--color-stone)">
                  {errors.capacity.message}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-(--color-stone)">
                Pris per timme <span className="text-(--color-gold)">*</span>
              </label>
              <Input
                type="number"
                placeholder="Pris per timme"
                {...register("pricePerHour", {
                  setValueAs: (value) => (value === "" ? undefined : Number(value)),
                })}
              />
              {errors.pricePerHour && (
                <p className="mt-2 text-xs text-(--color-stone)">
                  {errors.pricePerHour.message}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.2em] text-(--color-stone)">
                Kvadratmeter <span className="text-(--color-gold)">*</span>
              </label>
              <Input
                type="number"
                placeholder="Kvadratmeter"
                {...register("squareMeters", {
                  setValueAs: (value) => (value === "" ? undefined : Number(value)),
                })}
              />
              {errors.squareMeters && (
                <p className="mt-2 text-xs text-(--color-stone)">
                  {errors.squareMeters.message}
                </p>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-(--color-stone)">
              Beskrivning <span className="text-(--color-gold)">*</span>
            </label>
            <textarea
              rows={4}
              placeholder="Beskrivning"
              {...register("description")}
              className="w-full rounded-2xl border border-[rgba(29,42,56,0.12)] bg-white/80 px-4 py-3 text-sm text-(--color-ink) shadow-[0_10px_30px_rgba(29,42,56,0.08)] outline-none transition focus:border-(--color-gold)"
            />
            {errors.description && (
              <p className="mt-2 text-xs text-(--color-stone)">
                {errors.description.message}
              </p>
            )}
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-[0.2em] text-(--color-stone)">
              Typ <span className="text-(--color-gold)">*</span>
            </label>
            <Select {...register("type")}>
              <option value="KontorCoworking">Kontor & Coworking</option>
              <option value="MotenEvent">Moten & Event</option>
            </Select>
            {errors.type && (
              <p className="mt-2 text-xs text-(--color-stone)">{errors.type.message}</p>
            )}
          </div>
          <Button type="submit" disabled={mutation.isPending} className="w-full">
            {mutation.isPending ? "Sparar..." : "Spara ändringar"}
          </Button>
        </form>
        {mutation.isError && (
          <p className="mt-4 text-sm text-red-500">{mutation.error.message}</p>
        )}
        {mutation.isSuccess && (
          <p className="mt-4 text-sm text-(--color-forest)">Rummet är uppdaterat.</p>
        )}
      </div>
    </div>
  );
}






