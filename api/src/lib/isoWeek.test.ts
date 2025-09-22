import { describe, expect, it } from 'vitest';
import {
  endOfIsoWeek,
  getIsoWeek,
  isoWeeksInYear,
  periodPartsFor,
  startOfIsoWeek,
} from './isoWeek';

/**
 * Cases are taken from the ISO-8601 definition rather than from the legacy
 * implementation's output, which disagreed with it at year boundaries.
 */
describe('getIsoWeek', () => {
  it.each([
    // [date, expected ISO year, expected ISO week, why this case matters]
    ['2026-01-01', 2026, 1, 'a Thursday, so week 1 of its own year'],
    ['2026-08-08', 2026, 32, 'an ordinary mid-year Saturday'],
    ['2027-01-01', 2026, 53, 'a Friday that belongs to the previous ISO year'],
    ['2027-01-04', 2027, 1, 'the Monday that starts ISO week 1 of 2027'],
    ['2025-12-29', 2026, 1, 'a Monday already in the next ISO year'],
    ['2021-01-01', 2020, 53, 'a Friday in the long ISO year 2020'],
    ['2024-12-30', 2025, 1, 'a Monday belonging to the following ISO year'],
  ])('%s is %i-W%i (%s)', (input, year, week) => {
    expect(getIsoWeek(new Date(`${input}T00:00:00Z`))).toEqual({ year, week });
  });

  it('does not shift with the time of day', () => {
    const morning = getIsoWeek(new Date('2026-08-08T00:00:00Z'));
    const midnight = getIsoWeek(new Date('2026-08-08T23:59:59Z'));
    expect(morning).toEqual(midnight);
  });
});

describe('startOfIsoWeek and endOfIsoWeek', () => {
  it('starts weeks on Monday at midnight UTC', () => {
    const start = startOfIsoWeek(2026, 32);
    expect(start.toISOString()).toBe('2026-08-03T00:00:00.000Z');
    expect(start.getUTCDay()).toBe(1);
  });

  it('ends a week where the next one begins, so ranges do not overlap', () => {
    expect(endOfIsoWeek(2026, 32).toISOString()).toBe(startOfIsoWeek(2026, 33).toISOString());
  });

  it('round-trips every week of a long and an ordinary year', () => {
    for (const year of [2020, 2026]) {
      for (let week = 1; week <= isoWeeksInYear(year); week += 1) {
        expect(getIsoWeek(startOfIsoWeek(year, week))).toEqual({ year, week });
      }
    }
  });
});

describe('isoWeeksInYear', () => {
  it.each([
    [2020, 53],
    [2024, 52],
    [2026, 53],
    [2027, 52],
  ])('%i has %i ISO weeks', (year, weeks) => {
    expect(isoWeeksInYear(year)).toBe(weeks);
  });
});

describe('periodPartsFor', () => {
  it('records the calendar date and the ISO week side by side', () => {
    // The calendar year and ISO year differ here, which is why both are stored.
    expect(periodPartsFor(new Date('2027-01-01T09:30:00Z'))).toEqual({
      isoYear: 2026,
      isoWeek: 53,
      year: 2027,
      month: 1,
      day: 1,
    });
  });
});
