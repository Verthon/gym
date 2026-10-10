import { describe, it, expect } from "vitest";

import { Clock } from "../Clock.mts";
import { LocalDate } from "../LocalDate.mts";

const at = (iso: string) => Temporal.Instant.from(iso);

describe("LocalDate.today", () => {
	it("is the calendar date of the clock's instant in the clock's zone", () => {
		const instant = at("2025-09-12T22:30:00Z");
		expect(LocalDate.today(Clock.fixed(instant, "Europe/Warsaw")).toISO()).toBe(
			"2025-09-13"
		);
		expect(LocalDate.today(Clock.fixed(instant, "UTC")).toISO()).toBe(
			"2025-09-12"
		);
	});

	it("is equal for two instants on the same day", () => {
		const morning = Clock.fixed(at("2025-09-13T06:00:00Z"), "Europe/Warsaw");
		const evening = Clock.fixed(at("2025-09-13T20:00:00Z"), "Europe/Warsaw");
		const a = LocalDate.today(morning);
		const b = LocalDate.today(evening);
		expect(a.equals(b)).toBe(true);
		expect(a.isBefore(b)).toBe(false);
		expect(a.isAfter(b)).toBe(false);
	});
});

describe("LocalDate comparison", () => {
	const d = LocalDate.fromISO("2025-09-13");

	it("orders by calendar date", () => {
		expect(d.isBefore(d.plusDays(1))).toBe(true);
		expect(d.isAfter(d.plusDays(-1))).toBe(true);
		expect(d.isBefore(d)).toBe(false);
		expect(d.isAfter(d)).toBe(false);
	});

	it("crosses month and year boundaries", () => {
		expect(LocalDate.fromISO("2025-12-31").plusDays(1).toISO()).toBe(
			"2026-01-01"
		);
	});

	it("compares by value", () => {
		expect(d.equals(LocalDate.fromISO("2025-09-13"))).toBe(true);
		expect(d.equals(d.plusDays(1))).toBe(false);
	});
});

describe("LocalDate.fromISO", () => {
	it("rejects an invalid date", () => {
		expect(() => LocalDate.fromISO("2025-02-30")).toThrow(RangeError);
	});
});
