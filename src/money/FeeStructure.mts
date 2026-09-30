import type { EnrollmentFee } from "./EnrollmentFee.mts";
import { Money, type MoneyError } from "./Money.mts";
import type { MonthlyDues } from "./MonthlyDues.mts";
import type { PenaltyFee } from "./PenaltyFee.mts";

export type FeeStructureError = {
	code: "CURRENCY_MISMATCH";
	context: { currencies: string[] };
};

export class FeeStructure {
	private readonly monthlyDues: MonthlyDues;
	private readonly enrollmentFee: EnrollmentFee;
	private readonly penaltyFees: ReadonlyArray<PenaltyFee>;

	private constructor(
		monthlyDues: MonthlyDues,
		enrollmentFee: EnrollmentFee,
		penaltyFees: ReadonlyArray<PenaltyFee>
	) {
		this.monthlyDues = monthlyDues;
		this.enrollmentFee = enrollmentFee;
		this.penaltyFees = [...penaltyFees];
	}

	static create(
		monthlyDues: MonthlyDues,
		enrollmentFee: EnrollmentFee,
		penaltyFees: PenaltyFee[] = []
	):
		| { success: true; value: FeeStructure }
		| { success: false; error: FeeStructureError } {
		const currencies = new Set<string>([
			monthlyDues.getAmount().getCurrency(),
			enrollmentFee.getAmount().getCurrency(),
			...penaltyFees.map((p) => p.getAmount().getCurrency()),
		]);
		if (currencies.size > 1) {
			return {
				success: false,
				error: {
					code: "CURRENCY_MISMATCH",
					context: { currencies: [...currencies] },
				},
			};
		}
		return {
			success: true,
			value: new FeeStructure(monthlyDues, enrollmentFee, penaltyFees),
		};
	}

	/** Enrollment + first monthly due (preferred API). */
	public firstPaymentTotal():
		| { success: true; value: Money }
		| { success: false; error: MoneyError } {
		return this.enrollmentFee.getAmount().add(this.monthlyDues.getAmount());
	}

	/** Back-compat alias. */
	public calculateInitialCost():
		| { success: true; value: Money }
		| { success: false; error: MoneyError } {
		return this.firstPaymentTotal();
	}

	/** Sum of all penalties, in the common currency (fast, integer-safe). */
	public calculatePenaltyTotal():
		| { success: true; value: Money }
		| { success: false; error: MoneyError } {
		const currency = this.monthlyDues.getAmount().getCurrency();
		let totalMinor = 0;
		for (const p of this.penaltyFees) {
			totalMinor += p.getAmount().getAmountMinor();
		}
		return Money.fromMinor(totalMinor, currency);
	}

	public getMonthlyDues(): MonthlyDues {
		return this.monthlyDues;
	}
	public getEnrollmentFee(): EnrollmentFee {
		return this.enrollmentFee;
	}
	public getPenaltyFees(): ReadonlyArray<PenaltyFee> {
		return this.penaltyFees;
	}

	public equals(other: FeeStructure): boolean {
		if (!this.monthlyDues.equals(other.monthlyDues)) return false;
		if (!this.enrollmentFee.equals(other.enrollmentFee)) return false;

		const a = this.penaltyFees;
		const b = other.penaltyFees;
		if (a.length !== b.length) return false;

		for (let i = 0; i < a.length; i++) {
			const ai = a[i];
			const bi = b[i];
			if (bi === undefined || !ai?.equals(bi)) return false;
		}
		return true;
	}
}
