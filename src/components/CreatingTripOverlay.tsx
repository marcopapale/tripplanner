"use client";

import { useEffect, useState } from "react";

const MESSAGES = [
  "Stiamo preparando il tuo viaggio…",
  "Cerchiamo la destinazione sulla mappa…",
  "Sistemiamo le valigie…",
  "Selezioniamo i posti migliori…",
  "Ci siamo quasi…",
];

export function CreatingTripOverlay() {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => (i + 1) % MESSAGES.length);
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-6 px-6 text-center">
        <div className="relative h-24 w-24">
          <div className="absolute inset-0 rounded-full border-4 border-sand border-t-sunset animate-spin" />
          <div className="absolute inset-0 flex items-center justify-center text-4xl animate-trip-bounce">
            ✈️
          </div>
        </div>
        <div className="space-y-1">
          <p className="text-base font-semibold text-gray-700">{MESSAGES[messageIndex]}</p>
          <p className="text-sm text-gray-400">Un attimo e sei pronto a partire 🌍</p>
        </div>
      </div>
    </div>
  );
}
