"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import Button from "@/components/ui/Button";
import { apiFetch, getRooms } from "@/lib/api";
import { Room } from "@/lib/types";
import { getPublicStorageUrl } from "@/lib/supabaseStorageUrl";

const ROOM_TYPE_LABELS: Record<Room["type"], string> = {
  KontorCoworking: "Kontor & Coworking",
  MotenEvent: "Moten & Event",
};

export default function RoomDetailPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = Number(params.id);

  const { data } = useQuery<Room[]>({
    queryKey: ["rooms"],
    queryFn: getRooms,
  });
  const { data: me, isLoading: isLoadingMe } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<{ user: { username: string; role: string } }>("/api/me"),
    retry: false,
  });
  const deleteMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/room/delete/${roomId}`, {
        method: "DELETE",
      }),
    onSuccess: () => router.push("/rooms"),
  });

  const room = data?.find((item) => item.id === roomId);
  const isAdmin = me?.user?.role === "Admin";
  const sortedImages = room?.images
    ? [...room.images].sort((a, b) => a.sortOrder - b.sortOrder)
    : [];

  if (isLoadingMe) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
        <p className="text-sm text-(--color-stone)">Laddar...</p>
      </div>
    );
  }

  if (!me?.user) {
    router.replace(`/login?redirect=/rooms/${roomId}`);
    return null;
  }

  if (!data) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
        <p className="text-sm text-(--color-stone)">Laddar rum...</p>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
        <p className="text-sm text-(--color-stone)">Rummet hittades inte.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <div className="soft-card rounded-[32px] p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-(--color-gold)">
          {ROOM_TYPE_LABELS[room.type]}
        </p>
        <h1 className="mt-4 text-3xl font-semibold text-(--color-deep)">{room.name}</h1>
        <p className="mt-2 text-sm text-(--color-forest)">
          Kapacitet: {room.capacity} personer
        </p>
        <p className="mt-1 text-sm text-(--color-forest)">Adress: {room.address}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-(--color-forest)">
          <span className="rounded-full bg-white/80 px-4 py-2 font-semibold text-(--color-deep)">
            {room.pricePerHour} €/hora
          </span>
          <span className="rounded-full bg-white/80 px-4 py-2 font-semibold text-(--color-deep)">
            {room.squareMeters} m²
          </span>
        </div>
        <p className="mt-4 text-sm text-(--color-forest)">{room.description}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          {isAdmin && (
            <>
              <Link href={`/rooms/${room.id}/edit`}>
                <Button variant="outline">Redigera rum</Button>
              </Link>
              <Link href={`/admin/rooms/${room.id}/images`}>
                <Button variant="outline">Bilder</Button>
              </Link>
              <Button
                variant="outline"
                disabled={deleteMutation.isPending}
                onClick={() => {
                  if (window.confirm("Vill du ta bort rummet?")) {
                    deleteMutation.mutate();
                  }
                }}
              >
                {deleteMutation.isPending ? "Tar bort..." : "Ta bort rum"}
              </Button>
            </>
          )}
          <Link href="/bookings">
            <Button>Boka nu</Button>
          </Link>
        </div>
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-(--color-deep)">Galleriet</h2>
          {sortedImages.length === 0 ? (
            <p className="mt-3 text-sm text-(--color-stone)">No images yet</p>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {sortedImages.map((image) => (
                <div
                  key={image.id}
                  className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-white/50"
                >
                  <Image
                    src={getPublicStorageUrl(
                      image.bucket,
                      image.path,
                      image.updatedAt,
                    )}
                    alt={image.alt || `${room.name} image`}
                    fill
                    sizes="(min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
        {deleteMutation.isError && (
          <p className="mt-4 text-sm text-red-500">{deleteMutation.error.message}</p>
        )}
      </div>
    </div>
  );
}


