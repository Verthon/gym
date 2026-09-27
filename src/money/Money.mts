export type MoneyError =
	| { code: "INVALID_CURRENCY"; context: { currency: string } }
	| { code: "INVALID_MINOR_AMOUNT"; context: { amountMinor: number } }
	| {
			code: "INVALID_PRECISION";
			context: { input: string; currency: string; minorUnits: number };
	  }
	| { code: "CURRENCY_MISMATCH"; context: { left: string; right: string } }
	| { code: "OVERFLOW" };

const CURRENCY_MINOR_UNITS: Record<string, number> = {
	USD: 2,
	EUR: 2,
	PLN: 2,
	JPY: 0,
	GBP: 2,
};
const DEFAULT_MINOR_UNITS = 2;

function normalizeCurrency(code: string): string {
	return (code ?? "").trim().toUpperCase();
}
function isValidCurrency(code: string): boolean {
	// Keep it pragmatic: 3 uppercase letters.
	return /^[A-Z]{3}$/.test(code);
}
function minorUnitsFor(currency: string): number {
	return CURRENCY_MINOR_UNITS[currency] ?? DEFAULT_MINOR_UNITS;
}
function safeInt(n: number): boolean {
	return (
		Number.isFinite(n) &&
		Number.isInteger(n) &&
		Math.abs(n) <= Number.MAX_SAFE_INTEGER
	);
}
function roundHalfUp(x: number): number {
	return Math.sign(x) * Math.floor(Math.abs(x) + 0.5);
}

export class Money {
	private readonly amountMinor: number;
	private readonly currency: string;

	private constructor(props: { amountMinor: number; currency: string }) {
		this.amountMinor = props.amountMinor;
		this.currency = props.currency;
	}

	/** Factory from minor units (e.g., cents). Allows negatives; validates integer & ISO code. */
	static fromMinor(
		amountMinor: number,
		currencyInput: string
	): { success: true; value: Money } | { success: false; error: MoneyError } {
		const currency = normalizeCurrency(currencyInput);
		if (!isValidCurrency(currency)) {
			return {
				success: false,
				error: {
					code: "INVALID_CURRENCY",
					context: { currency: currencyInput },
				},
			};
		}
		if (!safeInt(amountMinor)) {
			return {
				success: false,
				error: { code: "INVALID_MINOR_AMOUNT", context: { amountMinor } },
			};
		}
		return { success: true, value: new Money({ amountMinor, currency }) };
	}

	/**
	 * Factory from major units given as a string/number (exact parsing, no FP drift).
	 * Rejects more fractional digits than currency allows (INVALID_PRECISION).
	 */
	static fromMajor(
		major: string | number,
		currencyInput: string
	): { success: true; value: Money } | { success: false; error: MoneyError } {
		const currency = normalizeCurrency(currencyInput);
		if (!isValidCurrency(currency)) {
			return {
				success: false,
				error: {
					code: "INVALID_CURRENCY",
					context: { currency: currencyInput },
				},
			};
		}
		const minorUnits = minorUnitsFor(currency);
		const raw = String(major).trim();
		const neg = raw.startsWith("-");
		const s = neg ? raw.slice(1) : raw;

		if (!/^\d+(\.\d+)?$/.test(s)) {
			return {
				success: false,
				error: {
					code: "INVALID_PRECISION",
					context: { input: raw, currency, minorUnits },
				},
			};
		}

		const [intPart, fracPart = ""] = s.split(".");
		if (fracPart.length > minorUnits) {
			return {
				success: false,
				error: {
					code: "INVALID_PRECISION",
					context: { input: raw, currency, minorUnits },
				},
			};
		}

		const paddedFrac = fracPart.padEnd(minorUnits, "0");
		const amountMinorStr = (intPart || "0") + (minorUnits ? paddedFrac : "");
		const parsed = Number(amountMinorStr);
		if (!Number.isSafeInteger(parsed))
			return { success: false, error: { code: "OVERFLOW" } };

		const amountMinor = neg ? -parsed : parsed;
		return Money.fromMinor(amountMinor, currency);
	}

	/** Arithmetic — result is a new VO; fail if currencies differ. */
	add(
		other: Money
	): { success: true; value: Money } | { success: false; error: MoneyError } {
		if (this.currency !== other.currency) {
			return {
				success: false,
				error: {
					code: "CURRENCY_MISMATCH",
					context: { left: this.currency, right: other.currency },
				},
			};
		}
		const sum = this.amountMinor + other.amountMinor;
		if (!safeInt(sum)) return { success: false, error: { code: "OVERFLOW" } };
		return {
			success: true,
			value: new Money({ amountMinor: sum, currency: this.currency }),
		};
	}

	subtract(
		other: Money
	): { success: true; value: Money } | { success: false; error: MoneyError } {
		return this.add(
			new Money({ amountMinor: -other.amountMinor, currency: other.currency })
		);
	}

	/** Multiplies by a scalar (e.g., percentage, months) with HALF_UP rounding to minor units. */
	multiply(
		factor: number
	): { success: true; value: Money } | { success: false; error: MoneyError } {
		if (!Number.isFinite(factor))
			return { success: false, error: { code: "OVERFLOW" } };
		const product = this.amountMinor * factor;
		const rounded = roundHalfUp(product);
		if (!safeInt(rounded))
			return { success: false, error: { code: "OVERFLOW" } };
		return {
			success: true,
			value: new Money({ amountMinor: rounded, currency: this.currency }),
		};
	}

	equals(other: Money): boolean {
		return (
			this.amountMinor === other.amountMinor && this.currency === other.currency
		);
	}

	isZero(): boolean {
		return this.amountMinor === 0;
	}

	/** e.g., "1234" cents → "12.34" for USD/EUR/PLN; "100" JPY → "100" */
	toMajorString(): string {
		const mu = minorUnitsFor(this.currency);
		if (mu === 0) return String(this.amountMinor);
		const neg = this.amountMinor < 0 ? "-" : "";
		const s = String(Math.abs(this.amountMinor)).padStart(mu + 1, "0");
		const i = s.slice(0, -mu);
		const f = s.slice(-mu);
		return neg + i + "." + f;
	}

	getCurrency(): string {
		return this.currency;
	}
	getAmountMinor(): number {
		return this.amountMinor;
	}
}
