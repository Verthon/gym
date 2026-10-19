import { describe, it, expect } from "vitest";

import { Money } from "#/money/Money.mts";
import { LocalDate } from "#/utils/LocalDate.mts";
import { failWith, success } from "#/utils/test.mts";
import { BirthDate } from "../BirthDate.mts";
import { ContractDraft, type ContractDraftProps } from "../ContractDraft.mts";
import { ContractId } from "../ContractId.mts";
import { GovernmentIdInfo } from "../GovernmentIdInfo.mts";
import { PersonId } from "../PersonId.mts";

const today = LocalDate.fromISO("2025-09-13");
const at = Temporal.Instant.from("2025-09-13T10:00:00Z");

const eur = (minor: number) => success(Money.fromMinor(minor, "EUR"));

const draftWith = (overrides: Partial<ContractDraftProps["offer"]["fees"]> = {}) => {
	const personId = success(PersonId.create("adult-123"));
	return ContractDraft.create({
		id: success(ContractId.create("contract-1")),
		offer: {
			offerId: "offer-1",
			durationInMonths: 12,
			servicePackage: ["gym"],
			fees: {
				monthlyDues: eur(2000),
				enrollmentFee: eur(500),
				penalties: [],
				...overrides,
			},
		},
		userInfo: {
			personId,
			birthDate: success(BirthDate.create(LocalDate.fromISO("1990-01-01"), today)),
			governmentId: success(
				GovernmentIdInfo.create({ type: "ID_CARD", number: "ID-123", expiryDate: today.plusDays(30) })
			),
			governmentIdAttested: true,
		},
	});
};

describe("ContractDraft.prepare", () => {
	it("emits ContractPrepared once with the offer fees and the person", () => {
		const draft = draftWith();

		success(draft.prepare({ at, asOf: today }));

		const events = draft.pullEvents();
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({ type: "ContractPrepared", occurredAt: at });
		expect(events[0]?.payload.personId.equals(draft.personId)).toBe(true);
		expect(events[0]?.payload.fees).toBe(draft.fees);
		expect(draft.pullEvents()).toEqual([]);
	});

	it("emits nothing and stays Draft when rejected", () => {
		const draft = draftWith({ penalties: [{ reason: "late", amount: eur(-1) }] });

		failWith(draft.prepare({ at, asOf: today }), "NEGATIVE_FEE");

		expect(draft.status).toBe("Draft");
		expect(draft.pullEvents()).toEqual([]);
	});

	it("rejects negative monthly dues", () => {
		failWith(draftWith({ monthlyDues: eur(-1) }).prepare({ at, asOf: today }), "NEGATIVE_FEE");
	});

	it("rejects a negative enrollment fee", () => {
		failWith(draftWith({ enrollmentFee: eur(-1) }).prepare({ at, asOf: today }), "NEGATIVE_FEE");
	});

	it("emits no second event when prepared twice", () => {
		const draft = draftWith();
		success(draft.prepare({ at, asOf: today }));
		draft.pullEvents();

		failWith(draft.prepare({ at, asOf: today }), "ALREADY_PREPARED");

		expect(draft.pullEvents()).toEqual([]);
	});
});
