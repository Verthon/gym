import { addDays } from "date-fns/addDays";
import { format } from "date-fns/format";
import { isAfter } from "date-fns/isAfter";
import { isBefore } from "date-fns/isBefore";
import { parseISO } from "date-fns/parseISO";

// Simple, explicit LocalDate value object—never expose JS Date in domain.
export class LocalDate {
	private readonly value: Date;

	private constructor(value: Date) {
		this.value = value;
	}

	// Parse ISO string (YYYY-MM-DD or ISO date-time; trims to date part)
	public static fromISO(input: string): LocalDate {
		return new LocalDate(parseISO(input));
	}

	// Get today (always use this for tests/mockability later)
	public static today(): LocalDate {
		return new LocalDate(new Date());
	}

	// Basic business comparison
	public isBefore(other: LocalDate): boolean {
		return isBefore(this.value, other.value);
	}

	public isAfter(other: LocalDate) {
		return isAfter(this.value, other.value);
	}

	// Add days (returns a new LocalDate VO)
	public plusDays(days: number): LocalDate {
		return new LocalDate(addDays(this.value, days));
	}

	// Serialize to ISO date string (YYYY-MM-DD)
	public toISO(): string {
		return format(this.value, "yyyy-MM-dd");
	}

	// For domain use: raw JS Date, if needed by infrastructure
	public toJSDate(): Date {
		return new Date(this.value.getTime());
	}

	public equals(other: LocalDate): boolean {
		return this.toISO() === other.toISO();
	}
}
