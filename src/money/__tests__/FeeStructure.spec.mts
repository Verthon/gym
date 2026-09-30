import { describe, it, expect } from "vitest";

import { failWith, success } from "#/utils/test.mts";
import { Money } from "../Money.mts";
import { EnrollmentFee } from "../EnrollmentFee.mts";
import { FeeStructure } from "../FeeStructure.mts";
import { MonthlyDues } from "../MonthlyDues.mts";
import { PenaltyFee } from "../PenaltyFee.mts";

const EUR = (x: string) => success(Money.fromMajor(x, "EUR"));

describe("FeeStructure", () => {
	it("creates with a single currency and computes first payment total", () => {
		const dues = success(MonthlyDues.create(EUR("10.00")));
		const enroll = success(EnrollmentFee.create(EUR("99.00")));
		const late = success(PenaltyFee.create(EUR("3.00"), "LATE_PAYMENT"));
		const fs = success(FeeStructure.create(dues, enroll, [late]));

		expect(success(fs.firstPaymentTotal()).toMajorString()).toBe("109.00");
		// back-compat
		expect(success(fs.calculateInitialCost()).toMajorString()).toBe("109.00");
	});

	it("sums penalties in the same currency", () => {
		const dues = success(MonthlyDues.create(EUR("10.00")));
		const enroll = success(EnrollmentFee.create(EUR("0.00")));
		const p1 = success(PenaltyFee.create(EUR("1.10"), "LATE_PAYMENT"));
		const p2 = success(PenaltyFee.create(EUR("2.40"), "ADMINISTRATIVE_FEE"));
		const fs = success(FeeStructure.create(dues, enroll, [p1, p2]));

		expect(success(fs.calculatePenaltyTotal()).toMajorString()).toBe("3.50");
	});

	it("returns zero penalty when no penalties defined", () => {
		const dues = success(MonthlyDues.create(EUR("10.00")));
		const enroll = success(EnrollmentFee.create(EUR("0.00")));
		const fs = success(FeeStructure.create(dues, enroll, []));

		expect(success(fs.calculatePenaltyTotal()).toMajorString()).toBe("0.00");
	});

	it("rejects when currencies differ", () => {
		const eurDues = success(MonthlyDues.create(EUR("10.00")));
		const usdEnroll = success(
			EnrollmentFee.create(success(Money.fromMajor("1.00", "USD")))
		);
		const r = FeeStructure.create(eurDues, usdEnroll, []);
		failWith(r, "CURRENCY_MISMATCH");
	});
});
