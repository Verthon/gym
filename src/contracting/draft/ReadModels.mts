export type MoneyView = { amountMinor: number; currency: string };

export type OfferView = {
	offerId: string;
	durationsInMonths: ReadonlyArray<number>;
	servicePackage: ReadonlyArray<string>;
	fees: {
		monthlyDues: MoneyView;
		enrollmentFee: MoneyView;
		penalties: ReadonlyArray<{ reason: string; amount: MoneyView }>;
	};
};

export interface OfferReadModel {
	findOffer(offerId: string): Promise<OfferView | null>;
}

export type CustomerView = { customerId: string; birthDate: string };

export interface CustomerReadModel {
	findCustomer(customerId: string): Promise<CustomerView | null>;
}
