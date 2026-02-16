"use client";

import type { Room } from "./types";

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "";

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    cache: "no-store",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
  });

  if (response.status === 204) {
    return {} as T;
  }
  if (response.status === 304) {
    return {} as T;
  }

  const data = (await response.json()) as T;

  if (!response.ok) {
    const message = (data as { message?: string }).message ?? "Något gick fel";
    throw new Error(message);
  }

  return data;
}

export const getRooms = () => apiFetch<Room[]>("/api/rooms");
