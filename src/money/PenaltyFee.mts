import { Money } from "./Money.mjs";
import { err } from "@/utils/Result.mjs";

export type PenaltyFeeError =
	| { code: "ZERO_OR_NEGATIVE"; context: { amount: string } }
  | { code: "EXCEEDS_MAXIMUM"; context: { amount: string; maximum: string } }
  | { code: "INVALID_CURRENCY"; context: { currency: string } }
  | {
    code: "INVALID_REASON";
    context: { reason: string; validReasons: string[] };
    };


const PENALTY_REASONS = [
	"LATE_PAYMENT",
	"EARLY_TERMINATION",
	"DAMAGE_FEE",
	"ADMINISTRATIVE_FEE",
] as const;

export type PenaltyReason = (typeof PENALTY_REASONS)[number];

const isPenaltyReason = (value: string): value is PenaltyReason =>
	PENALTY_REASONS.some((r) => r === value);

export class PenaltyFee {
	private readonly amount: Money;
	private readonly reason: PenaltyReason;

	private constructor(amount: Money, reason: PenaltyReason) {
		this.amount = amount;
		this.reason = reason;
	}

	static create(
		amount: Money,
		reason: string
	):
		| { success: true; value: PenaltyFee }
		| { success: false; error: PenaltyFeeError } {
		// Fail-fast: validate reason first (cheapest validation)
		if (!isPenaltyReason(reason)) {
			return {
				success: false,
				error: {
					code: "INVALID_REASON",
					context: {
						reason,
						validReasons: [...PENALTY_REASONS],
					},
				},
			};
		}

		// Fail-fast: penalty amount must be positive
		if (amount.isZero() || amount.getAmountMinor() < 0) {
			return {
				success: false,
				error: {
					code: "ZERO_OR_NEGATIVE",
					context: { amount: amount.toMajorString() },
				},
			};
		}

		// Business rule: penalty fee cannot exceed $200
		const maxAmount = Money.fromMajor("200.00", amount.getCurrency());
		if (!maxAmount.success) {
return err({ code: "INVALID_CURRENCY", context: { currency: amount.getCurrency() } });
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

		return { success: true, value: new PenaltyFee(amount, reason) };
	}

	public equals(other: PenaltyFee): boolean {
		return this.amount.equals(other.amount) && this.reason === other.reason;
	}

	public getAmount(): Money {
		return this.amount;
	}

	public getReason(): PenaltyReason {
		return this.reason;
	}
}
