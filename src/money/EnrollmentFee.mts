import { Money } from "./Money.mjs";

export type EnrollmentFeeError =
	| { code: "NEGATIVE_AMOUNT"; context: { amount: string } }
	| { code: "EXCEEDS_MAXIMUM"; context: { amount: string; maximum: string } };

export class EnrollmentFee {
	private readonly amount: Money;

	private constructor(amount: Money) {
		this.amount = amount;
	}

	static create(
		amount: Money
	):
		| { success: true; value: EnrollmentFee }
		| { success: false; error: EnrollmentFeeError } {
		// Fail-fast: enrollment fee cannot be negative (but can be zero for promotions)
		if (amount.getAmountMinor() < 0) {
			return {
				success: false,
				error: {
					code: "NEGATIVE_AMOUNT",
					context: { amount: amount.toMajorString() },
				},
			};
		}

		// Business rule: enrollment fee cannot exceed $500
		const maxAmount = Money.fromMajor("500.00", amount.getCurrency());
		if (!maxAmount.success) {
			return { success: false, error: maxAmount.error };
		}

		if (amount.getAmountMinor() > maxAmount.value.getAmountMinor()) {
			return {
				success: false,
				error: {
					code: "EXCEEDS_MAXIMUM",
					context: {
						amount: amount.toMajorString(),
						maximum: maxAmount.value.toMajorString(),
					},
				},
			};
		}

		return { success: true, value: new EnrollmentFee(amount) };
	}

	public equals(other: EnrollmentFee): boolean {
		return this.amount.equals(other.amount);
	}

	public getAmount(): Money {
		return this.amount;
	}
}
