/**
 * ISO-8601 week arithmetic, in UTC.
 *
 * The legacy implementation derived week numbers with local-time day counting
 * that disagreed with ISO week numbering, shifted with the server's timezone,
 * and could produce an off-by-one at year boundaries. Reports are indexed and
 * queried by these values, so the arithmetic is isolated here and covered by
 * tests rather than inlined into a Mongoose schema default.
 *
 * ISO rules: weeks start Monday, and week 1 is the week containing the first
 * Thursday of the year. The ISO year is therefore not always the calendar year
 * — 1 January 2027 falls in ISO week 53 of 2026.
 */

export interface IsoWeek {
  /** ISO week-numbering year, which may differ from the calendar year. */
  year: number;
  /** ISO week number, 1 to 53. */
  week: number;
}

/** Day of the ISO week: Monday is 1, Sunday is 7. */
function isoDayOfWeek(date: Date): number {
  const day = date.getUTCDay();
  return day === 0 ? 7 : day;
}

/** Midnight UTC on the given date, discarding any time component. */
function toUtcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function getIsoWeek(date: Date): IsoWeek {
  const target = toUtcMidnight(date);

  // Shift to the Thursday of this week: the ISO year is whichever year that
  // Thursday falls in. This is what makes the boundary cases come out right.
  target.setUTCDate(target.getUTCDate() + 4 - isoDayOfWeek(target));

  const year = target.getUTCFullYear();
  const firstOfYear = new Date(Date.UTC(year, 0, 1));
  const daysSinceFirst = (target.getTime() - firstOfYear.getTime()) / 86_400_000;
  const week = Math.floor(daysSinceFirst / 7) + 1;

  return { year, week };
}

/** Monday 00:00:00.000 UTC that starts the given ISO week. */
export function startOfIsoWeek(year: number, week: number): Date {
  // 4 January is always in ISO week 1, so anchor the calculation there.
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week1Monday = new Date(jan4);
  week1Monday.setUTCDate(jan4.getUTCDate() - (isoDayOfWeek(jan4) - 1));

  const start = new Date(week1Monday);
  start.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return start;
}

/** Exclusive end of the given ISO week: the following Monday at 00:00 UTC. */
export function endOfIsoWeek(year: number, week: number): Date {
  const end = startOfIsoWeek(year, week);
  end.setUTCDate(end.getUTCDate() + 7);
  return end;
}

/** Number of ISO weeks in a year: 52, or 53 when the year is "long". */
export function isoWeeksInYear(year: number): number {
  const dec28 = new Date(Date.UTC(year, 11, 28));
  return getIsoWeek(dec28).week;
}

/**
 * Calendar parts recorded alongside a report, derived in UTC so the values do
 * not depend on where the server runs.
 */
export function periodPartsFor(date: Date): {
  isoYear: number;
  isoWeek: number;
  year: number;
  month: number;
  day: number;
} {
  const { year: isoYear, week: isoWeek } = getIsoWeek(date);
  return {
    isoYear,
    isoWeek,
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}
