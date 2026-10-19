import { expect } from "vitest";

import { Clock } from "#/utils/Clock.mts";
import {
	contractStatus,
	createContractDraft,
	InMemoryContractDraftRepository,
	prepareContract,
	type CustomerReadModel,
	type CustomerView,
	type OfferReadModel,
	type OfferView,
} from "../index.mts";

const standardOffer: OfferView = {
	offerId: "offer-standard",
	durationsInMonths: [1, 3, 6, 12],
	servicePackage: ["gym", "sauna"],
	fees: {
		monthlyDues: { amountMinor: 9900, currency: "PLN" },
		enrollmentFee: { amountMinor: 4900, currency: "PLN" },
		penalties: [
			{ reason: "early termination", amount: { amountMinor: 20000, currency: "PLN" } },
		],
	},
};

type OfferChoice = {
	offerId?: string;
	durationsInMonths?: ReadonlyArray<number>;
	penaltyAmountMinor?: number;
};

type DraftChoice = {
	customer?: string;
	offer?: string;
	months?: number;
	idExpires?: string;
	idAttested?: boolean;
	guardianCoSignsFor?: string;
};

const atNoon = (date: string) => Temporal.Instant.from(`${date}T10:00:00Z`);

export const contractingOn = (today: string) => {
	let now = atNoon(today);
	const clock: Clock = { instant: () => now, timeZone: Clock.fixed(now).timeZone };

	const offers = new Map<string, OfferView>([[standardOffer.offerId, standardOffer]]);
	const customers = new Map<string, CustomerView>([
		["adult", { customerId: "adult", birthDate: "1990-05-01" }],
	]);
	const offerReadModel: OfferReadModel = {
		findOffer: async (offerId) => offers.get(offerId) ?? null,
	};
	const customerReadModel: CustomerReadModel = {
		findCustomer: async (customerId) => customers.get(customerId) ?? null,
	};
	const drafts = new InMemoryContractDraftRepository();

	const draftContract = (choice: DraftChoice = {}) => {
		const customerId = choice.customer ?? "adult";
		return createContractDraft({
			drafts,
			offers: offerReadModel,
			customers: customerReadModel,
			clock,
		})({
			offerId: choice.offer ?? standardOffer.offerId,
			customerId,
			durationInMonths: choice.months ?? 12,
			governmentId: {
				type: "ID_CARD",
				number: "ABC123456",
				expiryDate:
					choice.idExpires ?? now.toZonedDateTimeISO(clock.timeZone).toPlainDate().add({ years: 5 }).toString(),
				attestedBySalesSpecialist: choice.idAttested ?? true,
			},
			...(choice.guardianCoSignsFor === undefined
				? {}
				: { guardianCoSignature: { guardianId: "guardian", minorId: choice.guardianCoSignsFor } }),
		});
	};

	return {
		publishOffer: (choice: OfferChoice) => {
			const offerId = choice.offerId ?? standardOffer.offerId;
			offers.set(offerId, {
				...standardOffer,
				offerId,
				durationsInMonths: choice.durationsInMonths ?? standardOffer.durationsInMonths,
				fees: {
					...standardOffer.fees,
					penalties: [
						{
							reason: "early termination",
							amount: { amountMinor: choice.penaltyAmountMinor ?? 20000, currency: "PLN" },
						},
					],
				},
			});
			return offerId;
		},

		customer: (customerId: string, { born }: { born: string }) => {
			customers.set(customerId, { customerId, birthDate: born });
			return customerId;
		},

		nextDay: () => {
			now = now.add({ hours: 24 });
		},

		draftContract,

		draftedContract: async (choice: DraftChoice = {}) => {
			const result = await draftContract(choice);
			expect(result).toMatchObject({ success: true });
			if (!result.success) throw new Error("unreachable");
			return result.value.contractId;
		},

		prepare: (contractId: string) => prepareContract({ drafts, clock })({ contractId }),

		statusOf: async (contractId: string) => {
			const result = await contractStatus({ drafts })({ contractId });
			if (!result.success) return result.error.code;
			return result.value;
		},
	};
};

export const accepted = { success: true, value: undefined };

export const rejected = (code: string) => ({
	success: false,
	error: expect.objectContaining({ code }),
});
