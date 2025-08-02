import { describe, it, expect } from "vitest";

import { LocalDate } from "@/utils/LocalDate.mjs";
import { GovernmentIdInfo } from "../GovernmentIdInfo.mjs";
import { unwrap } from "@/utils/test.mjs";

describe("GovernmentIdInfo.create", () => {
	it("creates a valid ID without expiry", () => {
		const v = unwrap(
			GovernmentIdInfo.create({
				type: "PASSPORT",
				number: "ABC123",
				country: "PL",
			})
		);
		expect(v.getType()).toBe("PASSPORT");
		expect(v.getNumber()).toBe("ABC123");
		expect(v.getCountry()).toBe("PL");
		expect(v.getExpiryDate()).toBeUndefined();
	});

	it("accepts expiry equal to today (not expired)", () => {
		const today = LocalDate.today();
		const v = unwrap(
			GovernmentIdInfo.create({
				type: "ID_CARD",
				number: "XYZ789",
				country: "PL",
				expiryDate: today,
			})
		);
		expect(v.getExpiryDate()!.equals(today)).toBe(true);
	});

	it("rejects empty or too-short number", () => {
		expect(
			GovernmentIdInfo.create({ type: "PASSPORT", number: "", country: "PL" })
		).toEqual({
			success: false,
			error: { code: "INVALID_NUMBER", context: { number: "" } },
		});
		expect(
			GovernmentIdInfo.create({ type: "PASSPORT", number: "AB", country: "PL" })
		).toEqual({
			success: false,
			error: { code: "INVALID_NUMBER", context: { number: "AB" } },
		});
	});

	it("rejects expired when expiry is in the past", () => {
		const yesterday = LocalDate.today().plusDays(-1);
		expect(
			GovernmentIdInfo.create({
				type: "PASSPORT",
				number: "ABC123",
				country: "PL",
				expiryDate: yesterday,
			})
		).toEqual({
			success: false,
			error: { code: "EXPIRED", context: { expiryDate: yesterday } },
		});
	});

	it("accepts all permitted types", () => {
		for (const t of ["PASSPORT", "ID_CARD", "TEST_ID"]) {
			const r = GovernmentIdInfo.create({
				type: t as "PASSPORT" | "ID_CARD" | "TEST_ID",
				number: "N11322323",
				country: "PL",
			});
			// NOTE: above `as` can be avoided by inlining; instead do:
			// unwrap(GovernmentIdInfo.create({ type: 'PASSPORT', number: 'N11322323', country: 'PL' })); etc.
			expect(r.success).toBe(true);
		}
	});

	it("defensively copies input props (external mutation does not affect VO)", () => {
		// Use untyped data source to avoid casts while simulating hostile input
		const props = JSON.parse(
			JSON.stringify({ type: "PASSPORT", number: "ABC123", country: "PL" })
		);
		const vo = unwrap(GovernmentIdInfo.create(props));
		props.country = "DE";
		expect(vo.getCountry()).toBe("PL");
	});

	it("rejects unknown type at runtime (simulated untyped input)", () => {
		// JSON.parse returns `any`, so we can verify runtime guard without TS casts
		const bad = JSON.parse(
			'{"type":"DRIVER_LICENSE","number":"ABC123","country":"PL"}'
		);
		expect(GovernmentIdInfo.create(bad)).toEqual({
			success: false,
			error: { code: "INVALID_TYPE", context: { type: "DRIVER_LICENSE" } },
		});
	});
});

describe("GovernmentIdInfo.equals", () => {
	it("is true when all properties match and both expiry undefined", () => {
		const a = unwrap(
			GovernmentIdInfo.create({
				type: "PASSPORT",
				number: "X01",
				country: "PL",
			})
		);
		const b = unwrap(
			GovernmentIdInfo.create({
				type: "PASSPORT",
				number: "X01",
				country: "PL",
			})
		);
		expect(a.equals(b)).toBe(true);
	});

	it("is true when expiry dates are equal and other fields match", () => {
		const expiry = LocalDate.today().plusDays(3);
		const a = unwrap(
			GovernmentIdInfo.create({
				type: "ID_CARD",
				number: "N99",
				country: "PL",
				expiryDate: expiry,
			})
		);
		const b = unwrap(
			GovernmentIdInfo.create({
				type: "ID_CARD",
				number: "N99",
				country: "PL",
				expiryDate: expiry,
			})
		);
		expect(a.equals(b)).toBe(true);
	});

	it("is false when any field differs", () => {
		const expiry = LocalDate.today().plusDays(5);
		const ref = unwrap(
			GovernmentIdInfo.create({
				type: "PASSPORT",
				number: "N113223",
				country: "PL",
				expiryDate: expiry,
			})
		);

		expect(
			ref.equals(
				unwrap(
					GovernmentIdInfo.create({
						type: "ID_CARD",
						number: "N113223",
						country: "PL",
						expiryDate: expiry,
					})
				)
			)
		).toBe(false);
		expect(
			ref.equals(
				unwrap(
					GovernmentIdInfo.create({
						type: "PASSPORT",
						number: "N2213321",
						country: "PL",
						expiryDate: expiry,
					})
				)
			)
		).toBe(false);
		expect(
			ref.equals(
				unwrap(
					GovernmentIdInfo.create({
						type: "PASSPORT",
						number: "N113223",
						country: "DE",
						expiryDate: expiry,
					})
				)
			)
		).toBe(false);
		expect(
			ref.equals(
				unwrap(
					GovernmentIdInfo.create({
						type: "PASSPORT",
						number: "N113223",
						country: "PL",
						expiryDate: LocalDate.today().plusDays(6),
					})
				)
			)
		).toBe(false);
		expect(
			ref.equals(
				unwrap(
					GovernmentIdInfo.create({
						type: "PASSPORT",
						number: "N113223",
						country: "PL",
					})
				)
			)
		).toBe(false);
	});
});
