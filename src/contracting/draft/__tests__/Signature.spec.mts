import { describe, it, expect } from "vitest";

import { LocalDate } from "@/utils/LocalDate.mjs";
import { PersonId } from "../PersonId.mjs";
import { Signature } from "../Signature.mjs";
import { unwrap } from "@/utils/test.mjs";

describe("Signature.create", () => {
	it("creates when signer and date present", () => {
		const pid = unwrap(PersonId.create("user123"));
		const date = LocalDate.fromISO("2025-08-02");
		const v = unwrap(Signature.create({ signerId: pid, signedAt: date }));
		expect(v.getSignerId().equals(pid)).toBe(true);
		expect(v.getSignedAt().equals(date)).toBe(true);
	});

	it("rejects when signer or date missing", () => {
		const pid = unwrap(PersonId.create("abc"));
		const date = LocalDate.fromISO("2025-08-02");

		expect(Signature.create({ signerId: null, signedAt: date })).toEqual({
			success: false,
			error: { code: "MISSING_SIGNER" },
		});

		expect(Signature.create({ signerId: pid, signedAt: null })).toEqual({
			success: false,
			error: { code: "MISSING_DATE" },
		});
	});
});

describe("Signature.equals", () => {
	it("compares by signerId and signedAt", () => {
		const pid = unwrap(PersonId.create("abc"));
		const d1 = LocalDate.fromISO("2025-08-02");
		const d2 = LocalDate.fromISO("2025-08-03");
		const a = unwrap(Signature.create({ signerId: pid, signedAt: d1 }));
		const b = unwrap(Signature.create({ signerId: pid, signedAt: d1 }));
		const c = unwrap(Signature.create({ signerId: pid, signedAt: d2 }));
		expect(a.equals(b)).toBe(true);
		expect(a.equals(c)).toBe(false);
	});
});
