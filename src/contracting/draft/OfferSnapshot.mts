import type { Money } from "#/money/Money.mts";

export type OfferFees = Readonly<{
	monthlyDues: Money;
	enrollmentFee: Money;
	penalties: ReadonlyArray<Readonly<{ reason: string; amount: Money }>>;
}>;

export type OfferSnapshot = Readonly<{
	offerId: string;
	durationInMonths: number;
	servicePackage: ReadonlyArray<string>;
	fees: OfferFees;
}>;
