import { describe, it, expect } from "vitest";

import { LocalDate } from "#/utils/LocalDate.mts";
import { PersonId } from "../PersonId.mts";
import { GuardianCoSignature } from "../GuardianCoSignature.mts";
import { unwrap } from "#/utils/test.mts";

describe("GuardianCoSignature.create", () => {
	it("creates when guardian, minor, and date are valid and distinct", () => {
		const guardian = unwrap(PersonId.create("guardian-1"));
		const minor = unwrap(PersonId.create("minor-1"));
		const date = LocalDate.fromISO("2025-08-02");

		const v = unwrap(
			GuardianCoSignature.create({
				guardianId: guardian,
				minorId: minor,
				signedAt: date,
			})
		);
		expect(v.getGuardianId().equals(guardian)).toBe(true);
		expect(v.getMinorId().equals(minor)).toBe(true);
		expect(v.getSignedAt().equals(date)).toBe(true);
	});

	it("rejects when guardian == minor", () => {
		const same = unwrap(PersonId.create("same"));
		const date = LocalDate.fromISO("2025-08-02");
		expect(
			GuardianCoSignature.create({
				guardianId: same,
				minorId: same,
				signedAt: date,
			})
		).toEqual({ success: false, error: { code: "SAME_PERSON" } });
	});

	it("rejects when any required field missing", () => {
		const guardian = unwrap(PersonId.create("Mariusz"));
		const minor = unwrap(PersonId.create("Mariuszek"));
		const date = LocalDate.fromISO("2025-08-02");

		expect(
			GuardianCoSignature.create({
				guardianId: null,
				minorId: minor,
				signedAt: date,
			})
		).toEqual({ success: false, error: { code: "MISSING_GUARDIAN" } });
		expect(
			GuardianCoSignature.create({
				guardianId: guardian,
				minorId: null,
				signedAt: date,
			})
		).toEqual({ success: false, error: { code: "MISSING_MINOR" } });
		expect(
			GuardianCoSignature.create({
				guardianId: guardian,
				minorId: minor,
				signedAt: null,
			})
		).toEqual({ success: false, error: { code: "MISSING_DATE" } });
	});
});

describe("GuardianCoSignature.equals", () => {
	it("compares all properties", () => {
		const g = unwrap(PersonId.create("Mariush"));
		const m = unwrap(PersonId.create("Mariusz"));
		const d1 = LocalDate.fromISO("2025-08-02");
		const d2 = LocalDate.fromISO("2025-08-03");

		const a = unwrap(
			GuardianCoSignature.create({ guardianId: g, minorId: m, signedAt: d1 })
		);
		const b = unwrap(
			GuardianCoSignature.create({ guardianId: g, minorId: m, signedAt: d1 })
		);
		const c = unwrap(
			GuardianCoSignature.create({ guardianId: g, minorId: m, signedAt: d2 })
		);

		expect(a.equals(b)).toBe(true);
		expect(a.equals(c)).toBe(false);
	});
});
