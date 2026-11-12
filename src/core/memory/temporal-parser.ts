import { TemporalRange } from '../types';

/**
 * Temporal Parser for Minimi
 * Resolves natural language date references to absolute calendar boundaries.
 * Supports:
 * - Explicit dates: "3 November", "Nov 3rd", "November 5th", "2026-11-03"
 * - Relative weekdays: "last Tuesday", "on Monday", "this Friday"
 * - Relative offsets: "yesterday", "3 days ago", "two days ago", "5 days ago"
 * - Relative week offsets: "last week", "two weeks ago", "2 weeks ago on Friday"
 * - Colloquial anchors: "earlier this week", "over the weekend", "earlier today"
 */
export class TemporalParser {
  private static readonly DAYS_OF_WEEK: Record<string, number> = {
    sunday: 0, sun: 0,
    monday: 1, mon: 1,
    tuesday: 2, tue: 2,
    wednesday: 3, wed: 3,
    thursday: 4, thu: 4,
    friday: 5, fri: 5,
    saturday: 6, sat: 6,
  };

  private static readonly MONTHS: Record<string, number> = {
    january: 0, jan: 0,
    february: 1, feb: 1,
    march: 2, mar: 2,
    april: 3, apr: 3,
    may: 4,
    june: 5, jun: 5,
    july: 6, jul: 6,
    august: 7, aug: 7,
    september: 8, sep: 8, sept: 8,
    october: 9, oct: 9,
    november: 10, nov: 10,
    december: 11, dec: 11,
  };

  private static readonly WORD_NUMBERS: Record<string, number> = {
    one: 1, a: 1, an: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
    nine: 9,
    ten: 10,
    fourteen: 14,
  };

  private static parseNumber(str: string): number {
    const parsed = parseInt(str, 10);
    if (!isNaN(parsed)) return parsed;
    return this.WORD_NUMBERS[str.toLowerCase()] || 1;
  }

  /**
   * Parse temporal intent from prompt relative to a reference date
   */
  public static parse(prompt: string, referenceDate: Date = new Date()): TemporalRange | null {
    const text = prompt.toLowerCase();
    const refYear = referenceDate.getFullYear();

    // 1. ISO format: "2026-11-03" or "2026/11/03"
    const isoMatch = text.match(/\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b/);
    if (isoMatch) {
      const y = parseInt(isoMatch[1], 10);
      const m = parseInt(isoMatch[2], 10) - 1;
      const d = parseInt(isoMatch[3], 10);
      const target = new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
      const endOfDay = new Date(Date.UTC(y, m, d, 23, 59, 59, 999));
      return {
        startDate: target.toISOString(),
        endDate: endOfDay.toISOString(),
        label: `${d} ${Object.keys(this.MONTHS).find(k => this.MONTHS[k] === m) || m} ${y}`,
        anchorType: 'absolute',
      };
    }

    // 2. Explicit dates: "3 November", "Nov 3", "November 3rd", "3rd of Nov"
    const explicitDateRegex = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\b|\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec)\s+(\d{1,2})(?:st|nd|rd|th)?\b/i;
    const dateMatch = text.match(explicitDateRegex);
    if (dateMatch) {
      let day: number;
      let monthStr: string;

      if (dateMatch[1] && dateMatch[2]) {
        day = parseInt(dateMatch[1], 10);
        monthStr = dateMatch[2].toLowerCase();
      } else {
        monthStr = dateMatch[3].toLowerCase();
        day = parseInt(dateMatch[4], 10);
      }

      const month = this.MONTHS[monthStr];
      if (month !== undefined && day >= 1 && day <= 31) {
        const target = new Date(Date.UTC(refYear, month, day, 0, 0, 0, 0));
        const endOfDay = new Date(Date.UTC(refYear, month, day, 23, 59, 59, 999));
        return {
          startDate: target.toISOString(),
          endDate: endOfDay.toISOString(),
          label: `${day} ${monthStr.charAt(0).toUpperCase() + monthStr.slice(1)} ${refYear}`,
          anchorType: 'absolute',
        };
      }
    }

    // 3. Multi-week with optional weekday: "2 weeks ago on Friday", "two weeks ago", "last week"
    const weeksAgoRegex = /\b(last|\d+|one|two|three|four)\s+weeks?\s+ago(?:\s+(?:on\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat))?\b/i;
    const weeksMatch = text.match(weeksAgoRegex);
    if (weeksMatch) {
      const numWeeks = weeksMatch[1].toLowerCase() === 'last' ? 1 : this.parseNumber(weeksMatch[1]);
      const target = new Date(referenceDate);
      target.setDate(referenceDate.getDate() - (numWeeks * 7));

      if (weeksMatch[2]) {
        // Specific weekday in that target week
        const targetDay = this.DAYS_OF_WEEK[weeksMatch[2].toLowerCase()];
        const diff = target.getDay() - targetDay;
        target.setDate(target.getDate() - diff);
      }

      target.setHours(0, 0, 0, 0);
      const endOfDay = new Date(target);
      endOfDay.setHours(23, 59, 59, 999);

      return {
        startDate: target.toISOString(),
        endDate: endOfDay.toISOString(),
        label: `${numWeeks} week(s) ago (${target.toISOString().split('T')[0]})`,
        anchorType: 'relative',
      };
    }

    // 4. Days ago: "3 days ago", "two days ago", "five days ago"
    const daysAgoRegex = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+days?\s+ago\b/i;
    const daysAgoMatch = text.match(daysAgoRegex);
    if (daysAgoMatch) {
      const days = this.parseNumber(daysAgoMatch[1]);
      const target = new Date(referenceDate);
      target.setDate(referenceDate.getDate() - days);
      target.setHours(0, 0, 0, 0);

      const endOfDay = new Date(target);
      endOfDay.setHours(23, 59, 59, 999);

      return {
        startDate: target.toISOString(),
        endDate: endOfDay.toISOString(),
        label: `${days} day(s) ago (${target.toISOString().split('T')[0]})`,
        anchorType: 'relative',
      };
    }

    // 5. "yesterday"
    if (/\byesterday\b/i.test(text)) {
      const target = new Date(referenceDate);
      target.setDate(referenceDate.getDate() - 1);
      target.setHours(0, 0, 0, 0);
      const endOfDay = new Date(target);
      endOfDay.setHours(23, 59, 59, 999);

      return {
        startDate: target.toISOString(),
        endDate: endOfDay.toISOString(),
        label: `Yesterday (${target.toISOString().split('T')[0]})`,
        anchorType: 'relative',
      };
    }

    // 6. Relative Days: "last Tuesday", "last Monday", etc.
    const lastDayRegex = /\blast\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)\b/i;
    const lastDayMatch = text.match(lastDayRegex);
    if (lastDayMatch) {
      const targetDay = this.DAYS_OF_WEEK[lastDayMatch[1].toLowerCase()];
      const currentDay = referenceDate.getDay();
      
      let diff = currentDay - targetDay;
      if (diff <= 0) {
        diff += 7;
      }
      if (diff < 3 && currentDay === targetDay) {
        diff += 7;
      }

      const target = new Date(referenceDate);
      target.setDate(referenceDate.getDate() - diff);
      target.setHours(0, 0, 0, 0);

      const endOfDay = new Date(target);
      endOfDay.setHours(23, 59, 59, 999);

      return {
        startDate: target.toISOString(),
        endDate: endOfDay.toISOString(),
        label: `Last ${lastDayMatch[1]} (${target.toISOString().split('T')[0]})`,
        anchorType: 'relative',
      };
    }

    // 7. "on Monday", "this Monday", "on Tuesday"
    const onDayRegex = /\b(?:on|this)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)\b/i;
    const onDayMatch = text.match(onDayRegex);
    if (onDayMatch) {
      const targetDay = this.DAYS_OF_WEEK[onDayMatch[1].toLowerCase()];
      const currentDay = referenceDate.getDay();
      
      let diff = currentDay - targetDay;
      if (diff < 0) {
        diff += 7;
      } else if (diff === 0 && text.includes('this')) {
        diff = 0;
      } else if (diff === 0) {
        diff = 7;
      }

      const target = new Date(referenceDate);
      target.setDate(referenceDate.getDate() - diff);
      target.setHours(0, 0, 0, 0);

      const endOfDay = new Date(target);
      endOfDay.setHours(23, 59, 59, 999);

      return {
        startDate: target.toISOString(),
        endDate: endOfDay.toISOString(),
        label: `${onDayMatch[1]} (${target.toISOString().split('T')[0]})`,
        anchorType: 'relative',
      };
    }

    // 8. "earlier this week"
    if (/\bearlier\s+this\s+week\b/i.test(text)) {
      const currentDay = referenceDate.getDay();
      const daysToMon = currentDay === 0 ? 6 : currentDay - 1;
      const target = new Date(referenceDate);
      target.setDate(referenceDate.getDate() - Math.max(1, daysToMon));
      target.setHours(0, 0, 0, 0);

      return {
        startDate: target.toISOString(),
        endDate: referenceDate.toISOString(),
        label: `Earlier this week (since ${target.toISOString().split('T')[0]})`,
        anchorType: 'relative',
      };
    }

    // 9. "over the weekend"
    if (/\b(?:over\s+the\s+weekend|this\s+weekend|last\s+weekend)\b/i.test(text)) {
      const currentDay = referenceDate.getDay();
      // Most recent Saturday
      const daysToSat = (currentDay + 1) % 7;
      const sat = new Date(referenceDate);
      sat.setDate(referenceDate.getDate() - (daysToSat === 0 ? 7 : daysToSat));
      sat.setHours(0, 0, 0, 0);

      const sun = new Date(sat);
      sun.setDate(sat.getDate() + 1);
      sun.setHours(23, 59, 59, 999);

      return {
        startDate: sat.toISOString(),
        endDate: sun.toISOString(),
        label: `Weekend (${sat.toISOString().split('T')[0]} - ${sun.toISOString().split('T')[0]})`,
        anchorType: 'relative',
      };
    }

    return null;
  }

  /**
   * Check if prompt is asking about changes since a baseline
   */
  public static hasTemporalDeltaIntent(prompt: string): boolean {
    const text = prompt.toLowerCase();
    return (
      text.includes('changed') ||
      text.includes('change') ||
      text.includes('since then') ||
      text.includes('since') ||
      text.includes('still correct') ||
      text.includes('still accurate') ||
      text.includes('shipped something') ||
      text.includes('new features') ||
      text.includes('pricing changed') ||
      text.includes('updates') ||
      text.includes('updated') ||
      text.includes('today')
    );
  }
}
