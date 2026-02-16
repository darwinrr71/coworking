"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch, getRooms } from "@/lib/api";
import { Room } from "@/lib/types";
import Link from "next/link";
import Button from "@/components/ui/Button";

type Booking = {
  id: number;
  startTime: string;
  endTime: string;
};

export default function AdminPage() {
  const { data: me, isLoading: isLoadingMe } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<{ user: { username: string; role: string } }>("/api/me"),
    retry: false,
  });
  const { data: rooms } = useQuery<Room[]>({
    queryKey: ["rooms"],
    queryFn: getRooms,
  });
  const { data: bookings } = useQuery<Booking[]>({
    queryKey: ["bookings"],
    queryFn: () => apiFetch<Booking[]>("/api/booking/allbooking"),
    enabled: me?.user?.role === "Admin",
  });

  if (isLoadingMe) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <p className="text-sm text-(--color-stone)">Laddar...</p>
      </div>
    );
  }

  if (me?.user?.role !== "Admin") {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
        <p className="text-sm text-red-500">Du saknar behörighet för adminpanelen.</p>
      </div>
    );
  }

  const todayCount =
    bookings?.filter((booking) => {
      const start = new Date(booking.startTime);
      const now = new Date();
      return (
        start.getFullYear() === now.getFullYear() &&
        start.getMonth() === now.getMonth() &&
        start.getDate() === now.getDate()
      );
    }).length ?? 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-(--color-deep)">Adminpanel</h1>
          <p className="mt-2 text-sm text-(--color-forest)">
            Översikt av rum, bokningar och systemaktivitet.
          </p>
        </div>
        <Link href="/admin/create-admin">
          <Button variant="outline">Skapa admin</Button>
        </Link>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        <div className="soft-card rounded-3xl p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-(--color-gold)">
            Rum totalt
          </p>
          <p className="mt-4 text-3xl font-semibold text-(--color-deep)">
            {rooms?.length ?? 0}
          </p>
        </div>
        <div className="soft-card rounded-3xl p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-(--color-gold)">
            Bokningar idag
          </p>
          <p className="mt-4 text-3xl font-semibold text-(--color-deep)">
            {todayCount}
          </p>
        </div>
        <div className="soft-card rounded-3xl p-6">
          <p className="text-xs uppercase tracking-[0.3em] text-(--color-gold)">
            Systemstatus
          </p>
          <p className="mt-4 text-3xl font-semibold text-(--color-deep)">Stabil</p>
        </div>
      </div>
    </div>
  );
}


