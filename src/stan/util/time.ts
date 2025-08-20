import { basename } from 'node:path';

/**
 * UTC timestamp in YYYYMMDD-HHMMSS for filenames and logs.
 */
export const utcStamp = (): string => {
  const d = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(
    d.getUTCDate(),
  )}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
};

/**
 * Convert a UTC stamp (YYYYMMDD-HHMMSS) to a local time string.
 * Falls back to the original stamp if parsing fails.
 */
export const formatUtcStampLocal = (ts: string): string => {
  const m = ts.match(/^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/);
  if (!m) return ts;
  const [, y, mo, d, h, mi, s] = m.map((x) => Number.parseInt(x ?? '', 10));
  const dt = new Date(Date.UTC(y, mo - 1, d, h, mi, s));
  // Locale-friendly; callers can format/log as needed.
  return dt.toLocaleString();
};

/** Extract base file name from a path (utility kept here for convenience). */
export const fileNameOf = (p: string): string =>
  basename(p).replace(/\\/g, '/');
