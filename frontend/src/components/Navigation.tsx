"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";

const baseLinks = [
  { href: "/", label: "Hem" },
  { href: "/rooms", label: "Rum" },
  { href: "/profile", label: "Profil" },
];

export default function Navigation() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const queryClient = useQueryClient();

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () =>
      apiFetch<{ user: { username: string; role: string } }>("/api/me"),
    retry: false,
  });

  const logoutMutation = useMutation({
    mutationFn: () => apiFetch("/api/user/logout", { method: "POST" }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["me"] });
      setProfileOpen(false);
      setMobileMenuOpen(false);
    },
  });

  const isAdmin = me?.user?.role === "Admin";
  const links = isAdmin
    ? [...baseLinks, { href: "/admin", label: "Admin" }]
    : baseLinks;

  return (
    <header className="relative z-40">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-6">
        <Link
          href="/"
          className="max-w-[62vw] truncate text-lg font-semibold tracking-wide text-(--color-deep) sm:max-w-none sm:text-xl"
        >
          Finita Hubbbbbb
        </Link>

        <nav className="hidden items-center gap-8 text-base font-semibold text-(--color-forest) md:flex">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "group relative px-1 py-1 tracking-[0.01em] transition-colors duration-300 hover:text-(--color-ink)",
                pathname === link.href && "text-(--color-ink)",
              )}
            >
              {link.label}
              <span
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute left-0 right-0 -bottom-1 h-[2px] origin-left rounded-full bg-(--color-gold) transition duration-300",
                  pathname === link.href
                    ? "scale-x-100 opacity-100"
                    : "scale-x-0 opacity-0 group-hover:scale-x-100 group-hover:opacity-100",
                )}
              />
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          {me?.user && (
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[rgba(29,42,56,0.12)] bg-white/85 text-xs font-semibold uppercase tracking-wide text-(--color-ink) shadow-[0_10px_30px_rgba(29,42,56,0.08)] md:hidden">
              {me.user.username.slice(0, 1)}
            </span>
          )}
          <button
            type="button"
            onClick={() => setMobileMenuOpen((open) => !open)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(29,42,56,0.12)] bg-white/85 text-(--color-ink) shadow-[0_10px_30px_rgba(29,42,56,0.08)] md:hidden"
            aria-label={mobileMenuOpen ? "Stäng meny" : "Öppna meny"}
            aria-expanded={mobileMenuOpen}
          >
            <span className="text-lg leading-none">
              {mobileMenuOpen ? "×" : "☰"}
            </span>
          </button>

          {me?.user ? (
            <div className="relative hidden md:block">
              <button
                type="button"
                onClick={() => setProfileOpen((open) => !open)}
                onBlur={() => setProfileOpen(false)}
                className="group flex h-10 w-10 items-center justify-center rounded-full border border-[rgba(29,42,56,0.12)] bg-white/80 text-(--color-ink) shadow-[0_10px_30px_rgba(29,42,56,0.08)] transition hover:translate-y-[-1px]"
                aria-label="Inloggad användare"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-(--color-deep) text-xs font-semibold uppercase tracking-wide text-white">
                  {me.user.username.slice(0, 1)}
                </span>
                <span className="pointer-events-none absolute right-0 top-full mt-2 hidden rounded-full bg-(--color-deep) px-3 py-1 text-xs font-semibold text-white shadow group-hover:block">
                  {me.user.username}
                </span>
              </button>

              {profileOpen && (
                <div className="absolute right-0 mt-3 w-56 rounded-2xl border border-[rgba(29,42,56,0.12)] bg-white/95 p-4 text-(--color-ink) shadow-[0_20px_40px_rgba(29,42,56,0.12)]">
                  <p className="text-lg font-semibold">{me.user.username}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-(--color-stone)">
                    {me.user.role}
                  </p>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => logoutMutation.mutate()}
                    className="mt-4 w-full rounded-full border border-(--color-gold) px-4 py-2 text-sm font-semibold text-(--color-deep) transition hover:bg-(--color-gold) hover:text-white"
                  >
                    Logga ut
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href={`/login?redirect=${encodeURIComponent(pathname || "/")}`}
              className="group hidden relative px-1 py-1 text-base font-semibold text-(--color-forest) transition-colors duration-300 hover:text-(--color-ink) md:inline"
            >
              Logga in
              <span
                aria-hidden="true"
                className="pointer-events-none absolute left-0 right-0 -bottom-1 h-[2px] origin-left rounded-full bg-(--color-gold) scale-x-0 opacity-0 transition duration-300 group-hover:scale-x-100 group-hover:opacity-100"
              />
            </Link>
          )}
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="border-t border-[rgba(29,42,56,0.1)] bg-white/95 shadow-[0_18px_30px_rgba(29,42,56,0.08)] backdrop-blur md:hidden">
          <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6">
            <nav className="flex flex-col gap-2 text-sm font-semibold text-(--color-forest)">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "rounded-xl px-3 py-2 transition hover:bg-[rgba(29,42,56,0.06)]",
                    pathname === link.href &&
                      "bg-[rgba(29,42,56,0.08)] text-(--color-ink)",
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="mt-4 border-t border-[rgba(29,42,56,0.1)] pt-4">
              {me?.user ? (
                <div>
                  <p className="break-all text-sm font-semibold text-(--color-deep)">
                    {me.user.username}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-(--color-stone)">
                    {me.user.role}
                  </p>
                  <button
                    type="button"
                    onClick={() => logoutMutation.mutate()}
                    className="mt-3 w-full rounded-full border border-(--color-gold) px-4 py-2 text-sm font-semibold text-(--color-deep) transition hover:bg-(--color-gold) hover:text-white"
                  >
                    Logga ut
                  </button>
                </div>
              ) : (
                <Link
                  href={`/login?redirect=${encodeURIComponent(pathname || "/")}`}
                  className="inline-flex w-full items-center justify-center rounded-full border border-(--color-gold) px-4 py-2 text-sm font-semibold text-(--color-deep)"
                >
                  Logga in
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
