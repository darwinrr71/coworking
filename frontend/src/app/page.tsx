"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/components/ui/Button";
import DateField from "@/components/ui/DateField";
import Select from "@/components/ui/Select";
import TimeField from "@/components/ui/TimeField";
import NumberField from "@/components/ui/NumberField";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

export default function Home() {
  const router = useRouter();
  const todayIso = new Date().toLocaleDateString("en-CA");
  const [date, setDate] = useState("");
  const [hour, setHour] = useState("");
  const [roomType, setRoomType] = useState<"" | "KontorCoworking" | "MotenEvent">("");
  const [people, setPeople] = useState<number | undefined>(undefined);
  const [formError, setFormError] = useState<string | null>(null);

  const { data: me, isFetched } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<{ user: { username: string; role: string } }>("/api/me"),
    retry: false,
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!date) {
      setFormError("Välj ett datum för att söka rum.");
      return;
    }

    if (!/^\d{2}$/.test(hour)) {
      setFormError("Ange timme i format HH.");
      return;
    }

    const hourValue = Number(hour);
    if (!Number.isFinite(hourValue) || hourValue < 8 || hourValue > 22) {
      setFormError("Timmen måste vara mellan 08 och 22.");
      return;
    }

    if (!people || people < 1) {
      setFormError("Antal personer måste vara minst 1.");
      return;
    }

    const params = new URLSearchParams({
      date,
      hour,
      people: String(people),
    });

    if (roomType) {
      params.set("type", roomType);
    }

    router.push(`/rooms?${params.toString()}`);
  };

  return (
    <div className="relative">
      <section className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-14 sm:gap-14 sm:px-6 sm:py-16 lg:flex-row lg:items-center">
        <div className="flex-1 space-y-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-(--color-gold)">
            Hotel & coworking
          </p>
          <h1 className="text-3xl font-semibold text-(--color-deep) sm:text-4xl md:text-5xl">
            En elegant plats för fokus, möten och oförglömliga vistelser.
          </h1>
          <p className="max-w-xl text-sm leading-relaxed text-(--color-forest)">
            Finita Hub kombinerar coworking, mötesrum och hotellservice i en
            sömlös bokningsupplevelse. Hitta rätt rum, se tillgänglighet och
            hantera bokningar på några sekunder.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link href="/rooms">
              <Button>Utforska rum</Button>
            </Link>
            {isFetched && !me?.user && (
              <Link href="/register">
                <Button variant="outline">Skapa konto</Button>
              </Link>
            )}
          </div>
        </div>
        <form onSubmit={handleSubmit} className="glass-panel flex-1 rounded-[32px] p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <DateField
              value={date}
              onChange={setDate}
              min={todayIso}
              placeholder="DD/MM/ÅÅÅÅ"
            />
            <TimeField value={hour} onChange={setHour} placeholder="HH" />
            <Select
              value={roomType}
              onChange={(event) =>
                setRoomType(event.target.value as "" | "KontorCoworking" | "MotenEvent")
              }
            >
              <option value="">Rumstyp</option>
              <option value="KontorCoworking">Kontor & Coworking</option>
              <option value="MotenEvent">Moten & Event</option>
            </Select>
            <NumberField
              value={people}
              onChange={setPeople}
              placeholder="Antal personer"
              min={1}
            />
          </div>
          <div className="mt-6 flex items-center justify-between">
            <div>
              <p className="text-xs text-(--color-stone)">
                Realtidsuppdatering för tillgänglighet.
              </p>
              {formError && <p className="mt-2 text-xs text-red-500">{formError}</p>}
            </div>
            <Button type="submit" variant="primary">
              Sök rum
            </Button>
          </div>
        </form>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-5 px-4 pb-14 sm:gap-6 sm:px-6 sm:pb-16 md:grid-cols-3">
        {[
          {
            title: "Boutique-upplevelse",
            text: "Lugn miljö, kuraterad design och premiumservice.",
          },
          {
            title: "Flexibla bokningar",
            text: "Boka per timme, halvdag eller hela dagen.",
          },
          {
            title: "Live-notiser",
            text: "Få uppdateringar utan känslig data.",
          },
        ].map((item) => (
          <div key={item.title} className="soft-card rounded-3xl p-6">
            <h3 className="text-lg font-semibold text-(--color-deep)">
              {item.title}
            </h3>
            <p className="mt-2 text-sm text-(--color-forest)">{item.text}</p>
          </div>
        ))}
      </section>
    </div>
  );
}




