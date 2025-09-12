import { Money } from "./Money.mjs";
import { err } from "@/utils/Result.mjs";

export type MonthlyDuesError =
  | { code: "ZERO_OR_NEGATIVE"; context: { amount: string } }
  | { code: "EXCEEDS_MAXIMUM"; context: { amount: string; maximum: string } }
  | { code: "INVALID_CURRENCY"; context: { currency: string } };

export class MonthlyDues {
  private readonly amount: Money;

  private constructor(amount: Money) {
    this.amount = amount;
  }

  static create(
    amount: Money
  ):
    | { success: true; value: MonthlyDues }
    | { success: false; error: MonthlyDuesError } {
    // Fail-fast: validate amount is positive
    if (amount.isZero() || amount.getAmountMinor() < 0) {
      return {
        success: false,
        error: {
          code: "ZERO_OR_NEGATIVE",
          context: { amount: amount.toMajorString() },
        },
      };
    }

    // Business rule: monthly dues cannot exceed $1000
    const maxAmount = Money.fromMajor("1000.00", amount.getCurrency());
    if (!maxAmount.success) {
      return err({
        code: "INVALID_CURRENCY",
        context: { currency: amount.getCurrency() },
      });
    }

    // Compare amounts by converting to minor units
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

    return { success: true, value: new MonthlyDues(amount) };
  }

  public equals(other: MonthlyDues): boolean {
    return this.amount.equals(other.amount);
  }

  public getAmount(): Money {
    return this.amount;
  }
}
