"use client";

import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";

const eventLabels: Record<string, string> = {
  "New Room": "Ett nytt rum har lagts till.",
  "Room Updated": "Ett rum har uppdaterats.",
  "Booking Updated": "En bokning har uppdaterats.",
  "Booking Deleted": "En bokning har tagits bort.",
  "New Booking": "En ny bokning har skapats.",
  "System activity": "Systemet rapporterar en ny händelse.",
  "Socket.io": "Live-uppdatering från servern.",
};

export default function LiveNotifications() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:9000";
    const socket: Socket = io(socketUrl, { withCredentials: true });
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const handleEvent = (event: string) => () => {
      const label = eventLabels[event] ?? "Ny uppdatering från systemet.";
      setMessage(label);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      timeoutId = setTimeout(() => setMessage(null), 4500);
    };

    const subscriptions = Object.keys(eventLabels).map((event) => {
      const handler = handleEvent(event);
      socket.on(event, handler);
      return { event, handler };
    });

    socket.on("Socket.io", handleEvent("Socket.io"));

    return () => {
      subscriptions.forEach(({ event, handler }) => socket.off(event, handler));
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      socket.disconnect();
    };
  }, []);

  if (!message) return null;

  return (
    <div className="fixed inset-x-3 bottom-4 z-30 mx-auto w-[calc(100%-1.5rem)] max-w-xs sm:inset-auto sm:right-6 sm:bottom-6 sm:mx-0 sm:w-auto rounded-2xl border border-[rgba(197,138,42,0.4)] bg-white/80 px-4 py-3 text-xs font-semibold text-(--color-deep) shadow-[0_18px_40px_rgba(29,42,56,0.18)] backdrop-blur">
      {message}
    </div>
  );
}



