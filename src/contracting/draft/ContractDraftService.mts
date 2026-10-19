import { Money } from "#/money/Money.mts";
import type { Clock } from "#/utils/Clock.mts";
import { LocalDate } from "#/utils/LocalDate.mts";
import { err, ok, okVoid, type Result } from "#/utils/Result.mts";
import { BirthDate } from "./BirthDate.mts";
import { ContractDraft, type ContractDraftError, type ContractDraftStatus } from "./ContractDraft.mts";
import { ContractId } from "./ContractId.mts";
import type { ContractDraftRepository } from "./ContractDraftRepository.mts";
import { GovernmentIdInfo } from "./GovernmentIdInfo.mts";
import { GuardianCoSignature } from "./GuardianCoSignature.mts";
import type { OfferFees } from "./OfferSnapshot.mts";
import { PersonId } from "./PersonId.mts";
import type { CustomerReadModel, MoneyView, OfferReadModel, OfferView } from "./ReadModels.mts";

type DraftInput = {
	offerId: string;
	customerId: string;
	durationInMonths: number;
	governmentId: {
		type: "PASSPORT" | "ID_CARD";
		number: string;
		expiryDate: string;
		attestedBySalesSpecialist: boolean;
	};
	guardianCoSignature?: { guardianId: string; minorId: string };
};

type DraftErrorCode =
	| "OFFER_NOT_FOUND"
	| "CUSTOMER_NOT_FOUND"
	| "DURATION_NOT_OFFERED"
	| "INVALID_OFFER_FEES"
	| "INVALID_DATE"
	| "INVALID_PERSON_ID"
	| "INVALID_BIRTH_DATE"
	| "INVALID_GOVERNMENT_ID"
	| "INVALID_GUARDIAN_CO_SIGNATURE";

const invalid = (code: DraftErrorCode) => err({ code });

const parseDate = (input: string): LocalDate | null => {
	try {
		return LocalDate.fromISO(input);
	} catch {
		return null;
	}
};

const toMoney = (view: MoneyView): Money | null => {
	const money = Money.fromMinor(view.amountMinor, view.currency);
	return money.success ? money.value : null;
};

const toFees = (offer: OfferView): OfferFees | null => {
	const monthlyDues = toMoney(offer.fees.monthlyDues);
	const enrollmentFee = toMoney(offer.fees.enrollmentFee);
	if (!monthlyDues || !enrollmentFee) return null;
	const penalties: Array<{ reason: string; amount: Money }> = [];
	for (const penalty of offer.fees.penalties) {
		const amount = toMoney(penalty.amount);
		if (!amount) return null;
		penalties.push({ reason: penalty.reason, amount });
	}
	return { monthlyDues, enrollmentFee, penalties };
};

export const createContractDraft =
	(deps: {
		drafts: ContractDraftRepository;
		offers: OfferReadModel;
		customers: CustomerReadModel;
		clock: Clock;
	}) =>
	async (input: DraftInput): Promise<Result<{ contractId: string }, { code: DraftErrorCode }>> => {
		const offer = await deps.offers.findOffer(input.offerId);
		if (!offer) return invalid("OFFER_NOT_FOUND");
		const customer = await deps.customers.findCustomer(input.customerId);
		if (!customer) return invalid("CUSTOMER_NOT_FOUND");
		if (!offer.durationsInMonths.includes(input.durationInMonths)) {
			return invalid("DURATION_NOT_OFFERED");
		}

		const fees = toFees(offer);
		if (!fees) return invalid("INVALID_OFFER_FEES");

		const asOf = LocalDate.fromInstant(deps.clock.instant(), deps.clock.timeZone);
		const birth = parseDate(customer.birthDate);
		const expiryDate = parseDate(input.governmentId.expiryDate);
		if (!birth || !expiryDate) return invalid("INVALID_DATE");

		const personId = PersonId.create(customer.customerId);
		if (!personId.success) return invalid("INVALID_PERSON_ID");
		const birthDate = BirthDate.create(birth, asOf);
		if (!birthDate.success) return invalid("INVALID_BIRTH_DATE");
		const governmentId = GovernmentIdInfo.create({
			type: input.governmentId.type,
			number: input.governmentId.number,
			expiryDate,
		});
		if (!governmentId.success) return invalid("INVALID_GOVERNMENT_ID");

		let guardianCoSignature: GuardianCoSignature | undefined;
		if (input.guardianCoSignature) {
			const guardianId = PersonId.create(input.guardianCoSignature.guardianId);
			const minorId = PersonId.create(input.guardianCoSignature.minorId);
			if (!guardianId.success || !minorId.success) return invalid("INVALID_PERSON_ID");
			const coSignature = GuardianCoSignature.create({
				guardianId: guardianId.value,
				minorId: minorId.value,
				signedAt: asOf,
			});
			if (!coSignature.success) return invalid("INVALID_GUARDIAN_CO_SIGNATURE");
			guardianCoSignature = coSignature.value;
		}

		const draft = ContractDraft.create({
			id: deps.drafts.nextId(),
			offer: {
				offerId: offer.offerId,
				durationInMonths: input.durationInMonths,
				servicePackage: offer.servicePackage,
				fees,
			},
			userInfo: {
				personId: personId.value,
				birthDate: birthDate.value,
				governmentId: governmentId.value,
				governmentIdAttested: input.governmentId.attestedBySalesSpecialist,
			},
			...(guardianCoSignature ? { guardianCoSignature } : {}),
		});
		await deps.drafts.save(draft);
		return ok({ contractId: draft.id.toString() });
	};

type PrepareErrorCode = "CONTRACT_NOT_FOUND" | ContractDraftError["code"];

const findDraft = async (drafts: ContractDraftRepository, rawId: string) => {
	const id = ContractId.create(rawId);
	if (!id.success) return null;
	return drafts.get(id.value);
};

export const prepareContract =
	(deps: { drafts: ContractDraftRepository; clock: Clock }) =>
	async (input: { contractId: string }): Promise<Result<void, { code: PrepareErrorCode }>> => {
		const draft = await findDraft(deps.drafts, input.contractId);
		if (!draft) return err({ code: "CONTRACT_NOT_FOUND" });

		const at = deps.clock.instant();
		const asOf = LocalDate.fromInstant(at, deps.clock.timeZone);
		const prepared = draft.prepare({ at, asOf });
		if (!prepared.success) return err({ code: prepared.error.code });

		await deps.drafts.save(draft);
		return okVoid();
	};

export const contractStatus =
	(deps: { drafts: ContractDraftRepository }) =>
	async (input: { contractId: string }): Promise<Result<ContractDraftStatus, { code: "CONTRACT_NOT_FOUND" }>> => {
		const draft = await findDraft(deps.drafts, input.contractId);
		if (!draft) return err({ code: "CONTRACT_NOT_FOUND" });
		return ok(draft.status);
	};
