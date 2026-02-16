"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Button from "@/components/ui/Button";
import DateField from "@/components/ui/DateField";
import { apiFetch, getRooms } from "@/lib/api";
import { Room } from "@/lib/types";
import { getPublicStorageUrl } from "@/lib/supabaseStorageUrl";

type RoomFilter = "all" | "KontorCoworking" | "MotenEvent";

type RoomCardProps = {
  room: Room;
  isAdmin: boolean;
  isAuthenticated: boolean;
  availabilityStatus?: "FREE" | "BUSY" | null;
  selectedHour?: string | null;
};

const ROOM_TYPE_LABELS: Record<Exclude<RoomFilter, "all">, string> = {
  KontorCoworking: "Kontor & Coworking",
  MotenEvent: "Moten & Event",
};

const FILTERS: { id: RoomFilter; label: string }[] = [
  { id: "all", label: "All rum" },
  { id: "KontorCoworking", label: ROOM_TYPE_LABELS.KontorCoworking },
  { id: "MotenEvent", label: ROOM_TYPE_LABELS.MotenEvent },
];
const HOUR_OPTIONS = Array.from({ length: 15 }, (_, index) =>
  String(index + 8).padStart(2, "0")
);

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

function buildDayRange(dateString: string) {
  return {
    from: `${dateString}T00:00:00`,
    to: `${dateString}T23:59:59.999`,
  };
}

function RoomCardComponent({
  room,
  isAdmin,
  isAuthenticated,
  availabilityStatus = null,
  selectedHour = null,
}: RoomCardProps) {
  const router = useRouter();
  const galleryImages = useMemo(() => {
    const images = room.images ?? [];
    return [...images].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [room.images]);
  const hasImages = galleryImages.length > 0;
  const [activeIndex, setActiveIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  const handlePrev = useCallback(() => {
    if (!hasImages) return;
    setActiveIndex((prev) => (prev === 0 ? galleryImages.length - 1 : prev - 1));
  }, [galleryImages.length, hasImages]);

  const handleNext = useCallback(() => {
    if (!hasImages) return;
    setActiveIndex((prev) => (prev === galleryImages.length - 1 ? 0 : prev + 1));
  }, [galleryImages.length, hasImages]);

  useEffect(() => {
    if (!isLightboxOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsLightboxOpen(false);
      }
      if (event.key === "ArrowLeft") {
        handlePrev();
      }
      if (event.key === "ArrowRight") {
        handleNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleNext, handlePrev, isLightboxOpen]);


  return (
    <div className="glass-panel flex h-full flex-col overflow-hidden rounded-xl">
      <div className="group/hero relative h-[210px] w-full overflow-hidden">
        {!hasImages ? (
          <div className="flex h-full w-full items-center justify-center bg-white/70 text-sm text-(--color-stone)">
            No images yet
          </div>
        ) : (
          <Image
            src={getPublicStorageUrl(
              galleryImages[activeIndex].bucket,
              galleryImages[activeIndex].path,
              galleryImages[activeIndex].updatedAt,
            )}
            alt={galleryImages[activeIndex].alt || "Room image"}
            fill
            sizes="(max-width: 768px) 100vw, 600px"
            className="object-cover transition duration-700 ease-out group-hover/hero:scale-[1.03]"
          />
        )}
        {hasImages && (
          <button
            type="button"
            onClick={() => setIsLightboxOpen(true)}
            className="absolute inset-0 z-10"
            aria-label="Öppna bild i helskärm"
          />
        )}
        {hasImages && (
          <div className="pointer-events-none absolute left-1/2 top-4 z-20 w-[calc(100%-1.5rem)] max-w-[440px] -translate-x-1/2 rounded-full bg-black/60 px-3 py-2 text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-white opacity-100 transition sm:left-auto sm:right-4 sm:w-auto sm:max-w-none sm:translate-x-0 sm:text-xs sm:opacity-0 sm:group-hover/hero:opacity-100">
            Klicka för att se alla bilder
          </div>
        )}
        <button
          type="button"
          onClick={handlePrev}
          disabled={!hasImages}
          className="absolute left-4 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center rounded-full bg-white/80 px-4 py-3 text-sm font-semibold text-(--color-deep) opacity-100 shadow-[0_12px_28px_rgba(29,42,56,0.2)] transition-all duration-300 sm:-translate-x-3 sm:opacity-0 sm:group-hover/hero:translate-x-0 sm:group-hover/hero:opacity-100"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={handleNext}
          disabled={!hasImages}
          className="absolute right-4 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center rounded-full bg-white/80 px-4 py-3 text-sm font-semibold text-(--color-deep) opacity-100 shadow-[0_12px_28px_rgba(29,42,56,0.2)] transition-all duration-300 sm:translate-x-3 sm:opacity-0 sm:group-hover/hero:translate-x-0 sm:group-hover/hero:opacity-100"
        >
          ›
        </button>
        {hasImages && (
          <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/40 px-4 py-2">
            {galleryImages.map((image, index) => (
              <button
                key={image.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`Visa bild ${index + 1}`}
                className={`h-2.5 w-2.5 rounded-full transition ${
                  index === activeIndex ? "bg-white" : "bg-white/50 hover:bg-white/80"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.2em] text-(--color-gold)">
              {ROOM_TYPE_LABELS[room.type]}
            </p>
            <h3 className="mt-2 break-words text-xl font-semibold text-(--color-deep)">
              {room.name}
            </h3>
            <p className="mt-1 min-h-[2.2rem] text-xs tracking-[0.2em] text-(--color-stone)">
              {room.address}
            </p>
          </div>
          <div className="flex shrink-0 flex-row items-center gap-2 sm:flex-col sm:items-end">
            {selectedHour && availabilityStatus && (
              <span
                className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
                  availabilityStatus === "FREE"
                    ? "bg-(--color-forest) text-white"
                    : "bg-white/80 text-(--color-stone)"
                }`}
              >
                {selectedHour}:00 {availabilityStatus}
              </span>
            )}
            {isAdmin && (
              <Link
                href={`/rooms/${room.id}`}
                onClick={(event) => {
                  if (!isAuthenticated) {
                    event.preventDefault();
                    router.push(`/login?redirect=/rooms/${room.id}`);
                  }
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-(--color-gold) text-(--color-forest) transition hover:bg-(--color-gold) hover:text-white"
                aria-label="Redigera"
                title="Redigera"
              >
                <svg
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                </svg>
              </Link>
            )}
          </div>
        </div>
        <p className="mt-2 min-h-[2.2rem] text-sm text-(--color-forest)">{room.description}</p>
        <div className="mt-auto space-y-3 pt-1">
          <div className="flex flex-wrap items-center gap-3 text-sm text-(--color-forest)">
            <span className="rounded-full bg-white/80 px-4 py-2 font-semibold text-(--color-deep)">
              {room.pricePerHour} €/hora
            </span>
            <span className="rounded-full bg-white/80 px-4 py-2 font-semibold text-(--color-deep)">
              {room.capacity} pers
            </span>
            <span className="rounded-full bg-white/80 px-4 py-2 font-semibold text-(--color-deep)">
              {room.squareMeters} m²
            </span>
          </div>
          {!isAdmin && (
            <div className="flex justify-end">
              <Link
                href={`/bookings?roomId=${room.id}`}
                className="rounded-full border border-[rgba(197,138,42,0.6)] bg-white/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-(--color-forest) transition hover:border-(--color-gold) hover:bg-(--color-gold) hover:text-white"
              >
                Boka nu
              </Link>
            </div>
          )}
        </div>
      </div>

      {isLightboxOpen && hasImages
        ? createPortal(
            <div className="fixed inset-0 z-[999] flex items-center justify-center">
              <div
                className="absolute inset-0 bg-black/80"
                onClick={() => setIsLightboxOpen(false)}
              />
              <div className="relative z-10 flex h-full w-full items-center justify-center p-6">
                <div className="w-full max-w-[1200px]">
                  <div className="group/lightbox relative overflow-hidden rounded-3xl border border-white/20 bg-black/40 shadow-[0_30px_70px_rgba(0,0,0,0.45)]">
                    <div className="relative aspect-[16/9] max-h-[75vh] w-full">
                      <Image
                        src={getPublicStorageUrl(
                          galleryImages[activeIndex].bucket,
                          galleryImages[activeIndex].path,
                          galleryImages[activeIndex].updatedAt,
                        )}
                        alt={galleryImages[activeIndex].alt || "Room image"}
                        fill
                        sizes="(max-width: 1024px) 100vw, 1600px"
                        className="object-contain"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsLightboxOpen(false)}
                      className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-base font-semibold text-(--color-deep) shadow-[0_12px_28px_rgba(29,42,56,0.2)]"
                      aria-label="Stäng"
                    >
                      X
                    </button>
                     <button
                       type="button"
                       onClick={handlePrev}
                       className="absolute left-4 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center rounded-full bg-white/80 px-4 py-3 text-sm font-semibold text-(--color-deep) opacity-100 shadow-[0_12px_28px_rgba(29,42,56,0.2)] transition-all duration-300 sm:opacity-0 sm:group-hover/lightbox:opacity-100"
                     >
                       ‹
                     </button>
                     <button
                       type="button"
                       onClick={handleNext}
                       className="absolute right-4 top-1/2 z-20 flex -translate-y-1/2 items-center justify-center rounded-full bg-white/80 px-4 py-3 text-sm font-semibold text-(--color-deep) opacity-100 shadow-[0_12px_28px_rgba(29,42,56,0.2)] transition-all duration-300 sm:opacity-0 sm:group-hover/lightbox:opacity-100"
                     >
                       ›
                     </button>
                  </div>
                  <div className="mt-3 rounded-2xl border border-white/20 bg-black/40 p-3">
                    <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
                      {galleryImages.map((image, index) => (
                        <button
                          key={image.id}
                          type="button"
                          onClick={() => setActiveIndex(index)}
                          className={`relative h-16 overflow-hidden rounded-xl border transition sm:h-16 ${
                            index === activeIndex
                              ? "border-white shadow-[0_12px_28px_rgba(0,0,0,0.35)]"
                              : "border-transparent opacity-70 hover:opacity-100"
                          }`}
                          aria-label={`Visa bild ${index + 1}`}
                        >
                          <Image
                            src={getPublicStorageUrl(
                              image.bucket,
                              image.path,
                              image.updatedAt,
                            )}
                            alt={image.alt || "Room image"}
                            fill
                            sizes="200px"
                            className="object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
const RoomCard = memo(RoomCardComponent);
RoomCard.displayName = "RoomCard";

export default function RoomsPage() {
  const router = useRouter();
  const todayIso = new Date().toLocaleDateString("en-CA");
  const searchParams = useSearchParams();
  const { data, isLoading, error } = useQuery<Room[]>({
    queryKey: ["rooms"],
    queryFn: getRooms,
    staleTime: 60_000,
  });
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<{ user: { username: string; role: string } }>("/api/me"),
    retry: false,
    staleTime: 60_000,
  });
  const isAdmin = me?.user?.role === "Admin";
  const isAuthenticated = Boolean(me?.user);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  const requestedType = searchParams.get("type");
  const requestedPeople = Number(searchParams.get("people") ?? "");
  const requestedDate = searchParams.get("date");
  const requestedHour = searchParams.get("hour");
  const requestedHourFilter =
    requestedHour && /^\d{2}$/.test(requestedHour) ? Number(requestedHour) : NaN;
  const normalizedRequestedHour =
    Number.isFinite(requestedHourFilter) && requestedHourFilter >= 8 && requestedHourFilter <= 22
      ? String(requestedHourFilter).padStart(2, "0")
      : null;
  const requestedTypeFilter: RoomFilter =
    requestedType === "KontorCoworking" || requestedType === "MotenEvent"
      ? requestedType
      : "all";
  const selectedType = requestedTypeFilter;
  const selectedHour = normalizedRequestedHour;
  const selectedDate = requestedDate ?? "";
  const hasAvailabilityFilter = Boolean(selectedDate && selectedHour);

  const setQueryParams = useCallback(
    (next: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(next).forEach(([key, value]) => {
        if (!value) {
          params.delete(key);
          return;
        }
        params.set(key, value);
      });
      const query = params.toString();
      router.replace(query ? `/rooms?${query}` : "/rooms");
    },
    [router, searchParams]
  );

  const scrollToResults = useCallback(() => {
    requestAnimationFrame(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const handleDateChange = (value: string) => {
    if (!value) {
      setQueryParams({ date: null, hour: null });
      scrollToResults();
      return;
    }
    setQueryParams({ date: value });
    scrollToResults();
  };

  const handleHourSelect = (hourValue: string) => {
    if (!selectedDate) {
      return;
    }
    setQueryParams({ hour: selectedHour === hourValue ? null : hourValue });
    scrollToResults();
  };

  const handleTypeSelect = (type: RoomFilter) => {
    setQueryParams({ type: type === "all" ? null : type });
    scrollToResults();
  };

  const handleClearFilters = () => {
    router.push("/rooms");
    scrollToResults();
  };

  const filteredRooms = useMemo(() => {
    if (!data) return [];
    let rooms = data;
    if (selectedType !== "all") {
      rooms = rooms.filter((room) => room.type === selectedType);
    }
    if (Number.isFinite(requestedPeople) && requestedPeople > 0) {
      rooms = rooms.filter((room) => room.capacity >= requestedPeople);
    }
    return rooms;
  }, [data, requestedPeople, selectedType]);
  const roomIds = useMemo(() => filteredRooms.map((room) => room.id), [filteredRooms]);
  const roomIdsParam = useMemo(() => roomIds.join(","), [roomIds]);

  const availabilityQuery = useQuery({
    queryKey: ["rooms-availability", selectedDate, selectedHour, roomIdsParam],
    queryFn: () => {
      if (!selectedDate || !selectedHour) {
        throw new Error("Missing availability filters");
      }
      const { from, to } = buildDayRange(selectedDate);
      const params = new URLSearchParams({
        from,
        to,
        roomIds: roomIdsParam,
        slotMinutes: "60",
      });
      const availabilityPath = isAuthenticated
        ? "/api/availability"
        : "/api/availability/public";
      return apiFetch<AvailabilityResponse>(`${availabilityPath}?${params.toString()}`);
    },
    enabled: hasAvailabilityFilter && roomIds.length > 0,
  });

  const availabilityByRoom = useMemo(() => {
    if (!selectedDate || !selectedHour || !availabilityQuery.data) {
      return new Map<number, "FREE" | "BUSY">();
    }
    const targetHour = Number(selectedHour);
    const map = new Map<number, "FREE" | "BUSY">();
    availabilityQuery.data.rooms.forEach((roomEntry) => {
      const matchingSlot = roomEntry.slots.find((slot) => {
        const [slotDateKey, slotTimeKey] = slot.startAt.split("T");
        if (!slotDateKey || !slotTimeKey || slotDateKey !== selectedDate) {
          return false;
        }
        return Number(slotTimeKey.slice(0, 2)) === targetHour;
      });
      if (matchingSlot) {
        map.set(roomEntry.roomId, matchingSlot.status);
      }
    });
    return map;
  }, [availabilityQuery.data, selectedDate, selectedHour]);

  const availabilitySummary = useMemo(() => {
    if (!hasAvailabilityFilter) {
      return {
        visibleRooms: filteredRooms,
        freeCount: 0,
        busyCount: 0,
        totalCount: filteredRooms.length,
      };
    }
    const freeRooms: Room[] = [];
    const busyRooms: Room[] = [];
    filteredRooms.forEach((room) => {
      if (availabilityByRoom.get(room.id) === "FREE") {
        freeRooms.push(room);
        return;
      }
      busyRooms.push(room);
    });
    const visibleRooms = [...freeRooms, ...busyRooms];
    return {
      visibleRooms,
      freeCount: freeRooms.length,
      busyCount: busyRooms.length,
      totalCount: visibleRooms.length,
    };
  }, [availabilityByRoom, filteredRooms, hasAvailabilityFilter]);
  const { visibleRooms, freeCount, busyCount, totalCount } = availabilitySummary;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-start">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold text-(--color-deep)">Alla rum</h1>
              <p className="mt-2 text-sm text-(--color-forest)">
                Se aktuella rum och tillgänglighet i realtid.
              </p>
              {(selectedDate || requestedHour || requestedPeople || requestedType) && (
                <p className="mt-2 text-xs text-(--color-stone)">
                  Filter: {selectedDate ? `Datum ${selectedDate}` : "Datum valfritt"} |{" "}
                  {selectedHour ? `Tid ${selectedHour}:00` : "Tid valfri"} |{" "}
                  {Number.isFinite(requestedPeople) && requestedPeople > 0
                    ? `Minst ${requestedPeople} personer`
                    : "Kapacitet valfri"}
                </p>
              )}
              {hasAvailabilityFilter && !availabilityQuery.isLoading && !availabilityQuery.isError && (
                <p className="mt-1 text-xs text-(--color-stone)">
                  {freeCount} fria för {selectedHour}:00.
                </p>
              )}
            </div>
            {isAdmin && (
              <Link href="/rooms/new">
                <Button variant="outline">Skapa rum</Button>
              </Link>
            )}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-3 rounded-2xl border border-white/50 bg-white/35 px-4 py-3">
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-(--color-forest)">
              Datum
            </span>
            <div className="w-full max-w-[320px]">
              <DateField
                value={selectedDate}
                onChange={handleDateChange}
                min={todayIso}
                placeholder="DD/MM/ÅÅÅÅ"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-col items-start gap-3 rounded-2xl border border-white/50 bg-white/35 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center">
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-(--color-forest)">
              Rumstyp
            </span>
            <div className="w-full overflow-x-auto pb-1 sm:w-auto sm:overflow-visible sm:pb-0">
              <div className="inline-flex min-w-max gap-2 rounded-full bg-white/75 p-1 shadow-[0_8px_20px_rgba(29,42,56,0.08)]">
              {FILTERS.map((filter) => {
                const isActive = filter.id === selectedType;
                return (
                  <button
                    key={filter.id}
                    type="button"
                    onClick={() => handleTypeSelect(filter.id)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      isActive
                        ? "bg-(--color-deep) text-white shadow-[0_6px_14px_rgba(29,42,56,0.22)]"
                        : "text-(--color-forest) hover:bg-white"
                    }`}
                  >
                    {filter.label}
                  </button>
                );
              })}
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-col items-start gap-3 rounded-2xl border border-white/50 bg-white/35 px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center">
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-(--color-forest)">
              Tid
            </span>
            <div className="w-full overflow-x-auto pb-1 sm:w-auto sm:overflow-visible sm:pb-0">
              <div className="inline-flex min-w-max gap-2 sm:flex sm:min-w-0 sm:flex-wrap">
                {HOUR_OPTIONS.map((hourOption) => {
                  const isSelected = selectedHour === hourOption;
                  return (
                    <button
                      key={hourOption}
                      type="button"
                      onClick={() => handleHourSelect(hourOption)}
                      disabled={!selectedDate}
                      className={`rounded-full border border-white/60 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] transition ${
                        isSelected
                          ? "border-transparent bg-(--color-deep) text-white shadow-[0_6px_14px_rgba(29,42,56,0.22)]"
                          : "bg-white/75 text-(--color-forest) hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
                      }`}
                    >
                      {hourOption}:00
                    </button>
                  );
                })}
              </div>
            </div>
            {!selectedDate && (
              <p className="text-xs text-(--color-stone)">
                Välj datum först för att aktivera tider.
              </p>
            )}
            {selectedDate && !selectedHour && (
              <p className="text-xs text-(--color-stone)">Ahora elige un horario.</p>
            )}
          </div>
        </div>

        <aside className="glass-panel rounded-3xl p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-(--color-stone)">
            Live översikt
          </p>
          <p className="mt-3 text-lg font-semibold text-(--color-deep)">
            {selectedDate ? selectedDate : "Välj datum"}
            {selectedHour ? ` kl ${selectedHour}:00` : ""}
          </p>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-white/75 p-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-(--color-stone)">
                Fria
              </p>
              <p className="mt-2 text-xl font-semibold text-(--color-forest)">{freeCount}</p>
            </div>
            <div className="rounded-2xl bg-white/75 p-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-(--color-stone)">
                Upptagna
              </p>
              <p className="mt-2 text-xl font-semibold text-(--color-deep)">{busyCount}</p>
            </div>
            <div className="rounded-2xl bg-white/75 p-3 text-center">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-(--color-stone)">
                Totalt
              </p>
              <p className="mt-2 text-xl font-semibold text-(--color-stone)">{totalCount}</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-(--color-stone)">
            Välj datum + tid för att se exakt tillgänglighet per rum. Resultaten sorteras med fria rum först.
          </p>
          <button
            type="button"
            onClick={handleClearFilters}
            className="mt-5 w-full rounded-full border border-[rgba(197,138,42,0.6)] bg-white/75 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-(--color-forest) transition hover:border-(--color-gold) hover:bg-(--color-gold) hover:text-white"
          >
            Rensa filter
          </button>
        </aside>
      </div>

      {isLoading && <p className="mt-8 text-sm text-(--color-stone)">Laddar rum...</p>}
      {error && <p className="mt-8 text-sm text-red-500">{(error as Error).message}</p>}
      {availabilityQuery.isError && (
        <p className="mt-3 text-xs text-red-500">{(availabilityQuery.error as Error).message}</p>
      )}
      {isLoading && (
        <div className="mt-8 grid gap-6 sm:mt-10 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={`room-skeleton-${index}`}
              className="glass-panel animate-pulse overflow-hidden rounded-xl"
            >
              <div className="h-[210px] w-full bg-white/70" />
              <div className="space-y-3 p-5">
                <div className="h-3 w-24 rounded-full bg-white/80" />
                <div className="h-6 w-2/3 rounded-xl bg-white/80" />
                <div className="h-3 w-full rounded-xl bg-white/80" />
                <div className="h-3 w-5/6 rounded-xl bg-white/80" />
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        ref={resultsRef}
        className="mt-8 grid gap-6 sm:mt-10 sm:gap-6 md:grid-cols-2 xl:grid-cols-3"
      >
        {visibleRooms.map((room) => (
          <RoomCard
            key={room.id}
            room={room}
            isAdmin={isAdmin}
            isAuthenticated={isAuthenticated}
            availabilityStatus={
              hasAvailabilityFilter ? (availabilityByRoom.get(room.id) ?? "BUSY") : null
            }
            selectedHour={selectedHour}
          />
        ))}
        {!visibleRooms.length && !isLoading && (
          <div className="glass-panel rounded-3xl p-6">
            <p className="text-sm text-(--color-stone)">
              Inga rum matchar din filtrering. Prova annan rumstyp, kapacitet eller tid.
            </p>
            <button
              type="button"
              onClick={handleClearFilters}
              className="mt-4 rounded-full border border-[rgba(197,138,42,0.6)] bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-(--color-forest) transition hover:border-(--color-gold) hover:bg-(--color-gold) hover:text-white"
            >
              Rensa filter
            </button>
          </div>
        )}
      </div>
    </div>
  );
}









