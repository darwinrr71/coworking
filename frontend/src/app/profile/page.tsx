"use client";

import Button from "@/components/ui/Button";

export default function ProfilePage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <div className="glass-panel rounded-[32px] p-8">
        <h1 className="text-3xl font-semibold text-(--color-deep)">Min profil</h1>
        <p className="mt-2 text-sm text-(--color-forest)">
          Hantera dina uppgifter och säkerhetsinställningar.
        </p>
        <div className="mt-8 space-y-4 text-sm text-(--color-forest)">
          <div className="flex items-center justify-between border-b border-[rgba(29,42,56,0.1)] pb-3">
            <span>Användarnamn</span>
            <span className="font-semibold text-(--color-deep)">—</span>
          </div>
          <div className="flex items-center justify-between border-b border-[rgba(29,42,56,0.1)] pb-3">
            <span>Roll</span>
            <span className="font-semibold text-(--color-deep)">—</span>
          </div>
          <div className="flex items-center justify-between border-b border-[rgba(29,42,56,0.1)] pb-3">
            <span>Senast inloggad</span>
            <span className="font-semibold text-(--color-deep)">—</span>
          </div>
        </div>
        <div className="mt-6 flex gap-3">
          <Button variant="outline">Uppdatera profil</Button>
          <Button>Logga ut</Button>
        </div>
      </div>
    </div>
  );
}


