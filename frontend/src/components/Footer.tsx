"use client";

import Link from "next/link";

export default function Footer() {
  return (
    <footer className="relative z-10 mt-24 border-t border-[rgba(29,42,56,0.12)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10 sm:px-6 text-sm text-(--color-forest) md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-semibold text-(--color-deep)">Finita Hub</p>
          <p className="mt-1 max-w-md text-xs uppercase tracking-[0.2em] text-(--color-stone)">
            Elegant coworking & hotellbokning
          </p>
        </div>
        <div className="flex flex-wrap gap-4 text-xs font-semibold uppercase tracking-[0.2em]">
          <Link href="/content/policy">Policy</Link>
          <Link href="/content/about">Om oss</Link>
          <Link href="/content/contact">Kontakt</Link>
        </div>
      </div>
    </footer>
  );
}




