import { describe, it, expect } from "vitest";

import { LocalDate } from "#/utils/LocalDate.mts";
import { BirthDate } from "../BirthDate.mts";
import { unwrap } from "#/utils/test.mts";

const today = LocalDate.fromISO("2025-09-13");

describe("BirthDate.create", () => {
	it("accepts today or any past date", () => {
		expect(BirthDate.create(today, today).success).toBe(true);
		expect(BirthDate.create(today.plusDays(-1), today).success).toBe(true);
	});

	it("rejects future dates", () => {
		const future = today.plusDays(1);
		expect(BirthDate.create(future, today)).toEqual({
			success: false,
			error: { code: "IN_FUTURE", context: { birthDate: future } },
		});
	});
});

describe("BirthDate.age & isAtLeast", () => {
	it("counts full years on birthday", () => {
		const dob = unwrap(BirthDate.create(LocalDate.fromISO("2007-08-02"), today));
		const asOf = LocalDate.fromISO("2025-08-02");
		expect(dob.ageAsOf(asOf)).toBe(18);
		expect(dob.isAtLeast(18, asOf)).toBe(true);
	});

	it("one day before birthday is not yet the next year", () => {
		const dob = unwrap(BirthDate.create(LocalDate.fromISO("2007-08-02"), today));
		const asOf = LocalDate.fromISO("2025-08-01");
		expect(dob.ageAsOf(asOf)).toBe(17);
		expect(dob.isAtLeast(18, asOf)).toBe(false);
	});

	it("asOf earlier than birth yields 0", () => {
		const dob = unwrap(BirthDate.create(LocalDate.fromISO("2010-01-10"), today));
		const earlier = LocalDate.fromISO("2009-12-31");
		expect(dob.ageAsOf(earlier)).toBe(0);
		expect(dob.isAtLeast(1, earlier)).toBe(false);
	});
});

describe("BirthDate.equals", () => {
	it("compares by value", () => {
		const a = unwrap(BirthDate.create(LocalDate.fromISO("1990-05-20"), today));
		const b = unwrap(BirthDate.create(LocalDate.fromISO("1990-05-20"), today));
		const c = unwrap(BirthDate.create(LocalDate.fromISO("1991-05-20"), today));
		expect(a.equals(b)).toBe(true);
		expect(a.equals(c)).toBe(false);
	});
});
