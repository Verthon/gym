import { describe, expect, it } from "vitest";

import { accepted, contractingOn, rejected } from "./contracting.acceptance.dsl.mts";

describe("Draft a contract", () => {
	it("AC-PC-01 drafts a contract for a duration the offer allows", async () => {
		const gym = contractingOn("2026-10-19");
		const offer = gym.publishOffer({ offerId: "yearly", durationsInMonths: [12] });

		const contract = await gym.draftedContract({ offer, months: 12 });

		expect(await gym.statusOf(contract)).toBe("Draft");
	});

	it("AC-PC-02 rejects a duration the offer does not allow", async () => {
		const gym = contractingOn("2026-10-19");
		const offer = gym.publishOffer({ offerId: "short", durationsInMonths: [1, 3, 6] });

		expect(await gym.draftContract({ offer, months: 12 })).toEqual(rejected("DURATION_NOT_OFFERED"));
	});

	it("AC-PC-03 rejects an offer that does not exist", async () => {
		const gym = contractingOn("2026-10-19");

		expect(await gym.draftContract({ offer: "no-such-offer" })).toEqual(rejected("OFFER_NOT_FOUND"));
	});

	it("AC-PC-04 rejects a customer who does not exist", async () => {
		const gym = contractingOn("2026-10-19");

		expect(await gym.draftContract({ customer: "no-such-customer" })).toEqual(rejected("CUSTOMER_NOT_FOUND"));
	});
});

describe("Prepare the contract", () => {
	it("AC-PC-05 prepares an adult's contract with an attested valid ID", async () => {
		const gym = contractingOn("2026-10-19");
		const contract = await gym.draftedContract();

		expect(await gym.prepare(contract)).toEqual(accepted);
		expect(await gym.statusOf(contract)).toBe("Unsigned");
	});

	it("AC-PC-06 rejects an ID the Sales Specialist did not attest", async () => {
		const gym = contractingOn("2026-10-19");
		const contract = await gym.draftedContract({ idAttested: false });

		expect(await gym.prepare(contract)).toEqual(rejected("ID_NOT_ATTESTED"));
		expect(await gym.statusOf(contract)).toBe("Draft");
	});

	it("AC-PC-07 rejects an ID that expired before the preparation date", async () => {
		const gym = contractingOn("2026-10-18");
		const contract = await gym.draftedContract({ idExpires: "2026-10-18" });
		gym.nextDay();

		expect(await gym.prepare(contract)).toEqual(rejected("ID_EXPIRED"));
		expect(await gym.statusOf(contract)).toBe("Draft");
	});

	it("AC-PC-08 accepts an ID that expires on the preparation date", async () => {
		const gym = contractingOn("2026-10-19");
		const contract = await gym.draftedContract({ idExpires: "2026-10-19" });

		expect(await gym.prepare(contract)).toEqual(accepted);
		expect(await gym.statusOf(contract)).toBe("Unsigned");
	});

	it("AC-PC-09 accepts a customer who turns 18 on the preparation date without a guardian", async () => {
		const gym = contractingOn("2026-10-18");
		const customer = gym.customer("turns-18-tomorrow", { born: "2008-10-19" });
		const contract = await gym.draftedContract({ customer });
		gym.nextDay();

		expect(await gym.prepare(contract)).toEqual(accepted);
		expect(await gym.statusOf(contract)).toBe("Unsigned");
	});

	it("AC-PC-10 rejects a minor without a Guardian co-signature", async () => {
		const gym = contractingOn("2026-10-19");
		const customer = gym.customer("turns-18-tomorrow", { born: "2008-10-20" });
		const contract = await gym.draftedContract({ customer });

		expect(await gym.prepare(contract)).toEqual(rejected("MINOR_REQUIRES_GUARDIAN"));
		expect(await gym.statusOf(contract)).toBe("Draft");
	});

	it("AC-PC-11 accepts a minor with a Guardian co-signature for that minor", async () => {
		const gym = contractingOn("2026-10-19");
		const customer = gym.customer("minor", { born: "2012-03-01" });
		const contract = await gym.draftedContract({ customer, guardianCoSignsFor: customer });

		expect(await gym.prepare(contract)).toEqual(accepted);
		expect(await gym.statusOf(contract)).toBe("Unsigned");
	});

	it("AC-PC-12 rejects a Guardian co-signature for a different minor", async () => {
		const gym = contractingOn("2026-10-19");
		const customer = gym.customer("minor", { born: "2012-03-01" });
		const sibling = gym.customer("sibling", { born: "2014-06-01" });
		const contract = await gym.draftedContract({ customer, guardianCoSignsFor: sibling });

		expect(await gym.prepare(contract)).toEqual(rejected("GUARDIAN_FOR_DIFFERENT_MINOR"));
		expect(await gym.statusOf(contract)).toBe("Draft");
	});

	it("AC-PC-13 rejects an offer with a negative penalty", async () => {
		const gym = contractingOn("2026-10-19");
		const offer = gym.publishOffer({ offerId: "broken-fees", penaltyAmountMinor: -100 });
		const contract = await gym.draftedContract({ offer });

		expect(await gym.prepare(contract)).toEqual(rejected("NEGATIVE_FEE"));
		expect(await gym.statusOf(contract)).toBe("Draft");
	});

	it("AC-PC-14 rejects preparing a contract twice", async () => {
		const gym = contractingOn("2026-10-19");
		const contract = await gym.draftedContract();
		expect(await gym.prepare(contract)).toEqual(accepted);

		expect(await gym.prepare(contract)).toEqual(rejected("ALREADY_PREPARED"));
		expect(await gym.statusOf(contract)).toBe("Unsigned");
	});

	it("AC-PC-15 rejects a contract that does not exist", async () => {
		const gym = contractingOn("2026-10-19");

		expect(await gym.prepare("no-such-contract")).toEqual(rejected("CONTRACT_NOT_FOUND"));
	});
});
