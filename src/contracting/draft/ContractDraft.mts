import { GovernmentIdInfo, type GovernmentIdInfoProps } from "./GovernmentIdInfo.mjs";
import { CandidateInfo, type CandidateInfoProps } from "./CandidateInfo.mjs";
import { FeeStructure, type FeeStructureProps } from "./FeeStructure.mjs";
import type { GuardianSignature } from "./GuardianCoSignature.mjs";

export type PrepareContractDraftProps = {
	candidateId: string;
	identification: GovernmentIdInfoProps;
	candidateInfo: CandidateInfoProps;
	fees: FeeStructureProps;
	guardianSignature?: GuardianSignature;
};

type ContractDraftProps = {
	offer: {...}
	userInfo: {...}
};

/**
 * Represents the initial stage of a contract, where information is gathered and validated.
 */
export class ContractDraft {
	private readonly candidateId: string;
	private readonly identification: GovernmentIdInfo;
	private readonly candidateInfo: CandidateInfo;
	private readonly guardianSignature?: GuardianSignature;
	private readonly fees: FeeStructure;

	private constructor(props: ContractDraftProps) {
		...
	}

	private validateAgeInvariant() {

	}

	private validateIdInvariant() {

	}

	private validateFeeInvariant() {

	}

	private validateInvariants() {

	}

	private reject() {

	}

	public create() {

	}

	public toNotSignedContract() {

	}
}
