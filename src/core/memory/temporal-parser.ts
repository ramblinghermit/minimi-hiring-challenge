import { TemporalRange } from '../types';

/**
 * Temporal Parser for Minimi
 * Resolves natural language date references to absolute calendar boundaries
 * Handles: "last Tuesday", "on Monday", "3 November", "yesterday", "since then"
 */
export class TemporalParser {
  private static readonly DAYS_OF_WEEK: Record<string, number> = {
    sunday: 0,
    sun: 0,
    monday: 1,
    mon: 1,
    tuesday: 2,
    tue: 2,
    wednesday: 3,
    wed: 3,
    thursday: 4,
    thu: 4,
    friday: 5,
    fri: 5,
    saturday: 6,
    sat: 6,
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

  /**
   * Parse temporal intent from prompt relative to a reference date
   */
  public static parse(prompt: string, referenceDate: Date = new Date()): TemporalRange | null {
    const text = prompt.toLowerCase();
    const refYear = referenceDate.getFullYear();

    // 1. Explicit dates: "3 November", "Nov 3", "November 3rd", "3rd of Nov"
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

    // 2. Relative Days: "last Tuesday", "last Monday", etc.
    const lastDayRegex = /\blast\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday|sun|mon|tue|wed|thu|fri|sat)\b/i;
    const lastDayMatch = text.match(lastDayRegex);
    if (lastDayMatch) {
      const targetDay = this.DAYS_OF_WEEK[lastDayMatch[1].toLowerCase()];
      const currentDay = referenceDate.getDay();
      
      // Calculate days back
      let diff = currentDay - targetDay;
      if (diff <= 0) {
        diff += 7;
      }
      // "last X" usually refers to the previous week's occurrence if said on the same day or right after
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

    // 3. "on Monday", "this Monday", "on Tuesday"
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

    // 4. "yesterday"
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
      text.includes('today')
    );
  }
}
