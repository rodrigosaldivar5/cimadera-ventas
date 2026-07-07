// Business hours calculator for America/Argentina/Buenos_Aires
// Mon–Fri 08:00–17:00 (540 min/day). BsAs = UTC-3, no DST since ~2000.
//
// Validated cases (all times in BsAs local):
//   lunes 08:00 → 17:00         = 540 min
//   lunes 07:00 → 09:00         = 60 min
//   lunes 16:00 → martes 09:00  = 120 min
//   viernes 16:00 → lunes 09:00 = 120 min
//   sábado → domingo            = 0 min

const BSAS_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC-3: subtract from UTC to get BsAs local
const WORK_START_H = 8;   // 08:00 BsAs
const WORK_END_H = 17;    // 17:00 BsAs
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_HOUR = 60 * 60 * 1000;

function bsAsLocal(d: Date): Date {
  // Returns a Date whose getUTC* methods give BsAs local values
  return new Date(d.getTime() - BSAS_OFFSET_MS);
}

function getWorkWindowUtc(localDate: Date): { start: number; end: number } {
  // localDate: Date with getUTC* == BsAs local. Returns UTC ms for [08:00, 17:00] BsAs.
  const midnight = Date.UTC(
    localDate.getUTCFullYear(),
    localDate.getUTCMonth(),
    localDate.getUTCDate(),
  );
  return {
    start: midnight + WORK_START_H * MS_PER_HOUR + BSAS_OFFSET_MS,
    end:   midnight + WORK_END_H   * MS_PER_HOUR + BSAS_OFFSET_MS,
  };
}

function isWorkday(localDate: Date): boolean {
  const day = localDate.getUTCDay(); // 0=Sun … 6=Sat
  return day >= 1 && day <= 5;
}

export function calcularMinutosHabiles(start: Date, end: Date): number {
  if (start >= end) return 0;

  const startTs = start.getTime();
  const endTs   = end.getTime();

  // BsAs midnight of the start day (UTC)
  const startLocal = bsAsLocal(start);
  let dayTs = Date.UTC(
    startLocal.getUTCFullYear(),
    startLocal.getUTCMonth(),
    startLocal.getUTCDate(),
  ) + BSAS_OFFSET_MS;

  let minutes = 0;

  while (dayTs < endTs) {
    const dayLocal = bsAsLocal(new Date(dayTs));
    if (isWorkday(dayLocal)) {
      const { start: ws, end: we } = getWorkWindowUtc(dayLocal);
      const from = Math.max(ws, startTs);
      const to   = Math.min(we, endTs);
      if (to > from) minutes += (to - from) / 60000;
    }
    dayTs += MS_PER_DAY;
  }

  return Math.round(minutes);
}

export function formatMinutosHabiles(minutos: number): string {
  if (minutos <= 0) return '0 min';
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m} min`;
}
