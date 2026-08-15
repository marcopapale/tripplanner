import { differenceInCalendarDays, addDays, parseISO, format } from "date-fns";
import { it } from "date-fns/locale";

export function tripDayCount(startDate: string, endDate: string): number {
  return differenceInCalendarDays(parseISO(endDate), parseISO(startDate)) + 1;
}

export function tripDayDate(startDate: string, dayIndex: number): Date {
  return addDays(parseISO(startDate), dayIndex);
}

export function formatDayLabel(startDate: string, dayIndex: number): string {
  return format(tripDayDate(startDate, dayIndex), "d MMMM", { locale: it });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Es. "Lunedì 17 Agosto 2026" — usato nell'intestazione del programma giornaliero. */
export function formatDayFullLabel(startDate: string, dayIndex: number): string {
  const date = tripDayDate(startDate, dayIndex);
  const weekday = capitalize(format(date, "EEEE", { locale: it }));
  const day = format(date, "d", { locale: it });
  const month = capitalize(format(date, "MMMM", { locale: it }));
  const year = format(date, "yyyy", { locale: it });
  return `${weekday} ${day} ${month} ${year}`;
}

export function formatDateRange(startDate: string, endDate: string): string {
  const s = format(parseISO(startDate), "d MMM yyyy", { locale: it });
  const e = format(parseISO(endDate), "d MMM yyyy", { locale: it });
  return `${s} — ${e}`;
}

/** Days remaining until start (0 if trip has started, negative once finished is clamped to 0). */
export function daysUntilStart(startDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return differenceInCalendarDays(parseISO(startDate), today);
}

export function tripStatus(
  startDate: string,
  endDate: string
): "upcoming" | "ongoing" | "past" {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  if (today < start) return "upcoming";
  if (today > end) return "past";
  return "ongoing";
}

/** Current day index (0-based) if the trip is ongoing, otherwise null. */
export function currentDayIndex(startDate: string, endDate: string): number | null {
  if (tripStatus(startDate, endDate) !== "ongoing") return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return differenceInCalendarDays(today, parseISO(startDate));
}
