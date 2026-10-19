import { describe, it, expect } from "vitest";

import { LocalDate } from "#/utils/LocalDate.mts";
import { GovernmentIdInfo } from "../GovernmentIdInfo.mts";
import { unwrap } from "#/utils/test.mts";

const today = LocalDate.fromISO("2025-09-13");

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

	it("keeps the expiry date", () => {
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

	it("accepts all permitted types", () => {
		for (const type of ["PASSPORT", "ID_CARD", "TEST_ID"] as const) {
			const r = GovernmentIdInfo.create({
				type,
				number: "N11322323",
				country: "PL",
			});
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
		const expiry = today.plusDays(3);
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
		const expiry = today.plusDays(5);
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
						expiryDate: today.plusDays(6),
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
