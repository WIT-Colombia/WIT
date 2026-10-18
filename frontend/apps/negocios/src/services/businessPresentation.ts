import type { RealModality } from "./businessApiClient";

/** Read-only presentation of the persisted schedule, in its own timezone. */
export function getBusinessOpeningState(modalities: RealModality[], now = new Date()): { label: string; isOpen: boolean | null } {
  const active = modalities.filter(item => item.status === "ACTIVE");
  const modality = active.find(item => item.type === "PHYSICAL") ?? active[0];
  if (!modality?.hours.length) return { label: "Horario sin confirmar", isOpen: null };
  const timezone = modality.hours.find(hour => hour.timezone)?.timezone;
  if (!timezone) return { label: "Horario sin confirmar", isOpen: null };
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
    const value = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value;
    const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(value("weekday") ?? "");
    const minutes = Number(value("hour")) * 60 + Number(value("minute"));
    const time = (text: string) => { const [hour, minute] = text.split(":").map(Number); return hour * 60 + minute; };
    const current = modality.hours.find(hour => hour.dayOfWeek === day);
    const previous = modality.hours.find(hour => hour.dayOfWeek === (day + 6) % 7);
    if (!current || day < 0) return { label: "Horario sin confirmar", isOpen: null };
    const overnight = previous && !previous.isClosed && previous.opensAt && previous.closesAt && time(previous.opensAt) > time(previous.closesAt) && minutes < time(previous.closesAt);
    const today = !current.isClosed && current.opensAt && current.closesAt && (
      current.opensAt === "00:00" && current.closesAt === "23:59" ||
      (time(current.opensAt) > time(current.closesAt) ? minutes >= time(current.opensAt) : minutes >= time(current.opensAt) && minutes < time(current.closesAt))
    );
    const isOpen = Boolean(overnight || today);
    return { label: isOpen ? "Abierto ahora" : "Cerrado ahora", isOpen };
  } catch {
    return { label: "Horario sin confirmar", isOpen: null };
  }
}
