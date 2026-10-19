import { describe, it, expect } from "vitest";

import { Clock } from "#/utils/Clock.mts";
import { failWith } from "#/utils/test.mts";
import type { ContractDraft } from "../ContractDraft.mts";
import {
	InMemoryContractDraftRepository,
	type ContractDraftRepository,
} from "../ContractDraftRepository.mts";
import { createContractDraft, prepareContract } from "../ContractDraftService.mts";
import type { OfferView } from "../ReadModels.mts";

const clock = Clock.fixed("2026-10-19T10:00:00Z", "Europe/Warsaw");

const offer: OfferView = {
	offerId: "o-1",
	durationsInMonths: [12],
	servicePackage: ["gym"],
	fees: {
		monthlyDues: { amountMinor: 9900, currency: "PLN" },
		enrollmentFee: { amountMinor: 0, currency: "PLN" },
		penalties: [],
	},
};

const draftInput = {
	offerId: "o-1",
	customerId: "adult",
	durationInMonths: 12,
	governmentId: {
		type: "ID_CARD" as const,
		number: "ABC123456",
		expiryDate: "2030-01-01",
		attestedBySalesSpecialist: true,
	},
};

const draftDeps = (drafts: ContractDraftRepository, overrides: Partial<OfferView> = {}) => ({
	drafts,
	offers: { findOffer: async () => ({ ...offer, ...overrides }) },
	customers: { findCustomer: async () => ({ customerId: "adult", birthDate: "1990-05-01" }) },
	clock,
});

class RecordingRepository extends InMemoryContractDraftRepository {
	saved: ContractDraft[] = [];
	override async save(draft: ContractDraft) {
		this.saved.push(draft);
		await super.save(draft);
	}
}

class FailingRepository extends InMemoryContractDraftRepository {
	override async get(): Promise<ContractDraft | null> {
		throw new Error("storage down");
	}
}

describe("createContractDraft", () => {
	it("saves the new draft", async () => {
		const drafts = new RecordingRepository();

		const result = await createContractDraft(draftDeps(drafts))(draftInput);

		expect(result.success).toBe(true);
		expect(drafts.saved).toHaveLength(1);
	});

	it("drafts an already expired ID", async () => {
		const drafts = new RecordingRepository();

		const result = await createContractDraft(draftDeps(drafts))({
			...draftInput,
			governmentId: { ...draftInput.governmentId, expiryDate: "2020-01-01" },
		});

		expect(result.success).toBe(true);
	});

	it("rejects a malformed expiry date and saves nothing", async () => {
		const drafts = new RecordingRepository();

		const result = await createContractDraft(draftDeps(drafts))({
			...draftInput,
			governmentId: { ...draftInput.governmentId, expiryDate: "next year" },
		});

		failWith(result, "INVALID_DATE");
		expect(drafts.saved).toEqual([]);
	});

	it("rejects offer fees with an invalid currency", async () => {
		const result = await createContractDraft(
			draftDeps(new InMemoryContractDraftRepository(), {
				fees: { ...offer.fees, monthlyDues: { amountMinor: 100, currency: "??" } },
			})
		)(draftInput);

		failWith(result, "INVALID_OFFER_FEES");
	});

	it("rejects a Guardian co-signature where guardian and minor are the same person", async () => {
		const result = await createContractDraft(draftDeps(new InMemoryContractDraftRepository()))({
			...draftInput,
			guardianCoSignature: { guardianId: "kid", minorId: "kid" },
		});

		failWith(result, "INVALID_GUARDIAN_CO_SIGNATURE");
	});
});

describe("prepareContract", () => {
	it("saves the draft after a successful preparation", async () => {
		const drafts = new RecordingRepository();
		const created = await createContractDraft(draftDeps(drafts))(draftInput);
		if (!created.success) throw new Error("draft failed");
		drafts.saved = [];

		const result = await prepareContract({ drafts, clock })({ contractId: created.value.contractId });

		expect(result.success).toBe(true);
		expect(drafts.saved).toHaveLength(1);
		expect(drafts.saved[0]?.status).toBe("Unsigned");
	});

	it("saves nothing when preparation is rejected", async () => {
		const drafts = new RecordingRepository();
		const created = await createContractDraft(draftDeps(drafts))({
			...draftInput,
			governmentId: { ...draftInput.governmentId, attestedBySalesSpecialist: false },
		});
		if (!created.success) throw new Error("draft failed");
		drafts.saved = [];

		await prepareContract({ drafts, clock })({ contractId: created.value.contractId });

		expect(drafts.saved).toEqual([]);
	});

	it("treats a blank contract id as not found", async () => {
		const result = await prepareContract({ drafts: new InMemoryContractDraftRepository(), clock })({
			contractId: " ",
		});

		failWith(result, "CONTRACT_NOT_FOUND");
	});

	it("rejects when the repository fails", async () => {
		await expect(
			prepareContract({ drafts: new FailingRepository(), clock })({ contractId: "c-1" })
		).rejects.toThrow("storage down");
	});
});
