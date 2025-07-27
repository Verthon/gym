type GovernmentIdInfoProps = {
	type: 'passport' | 'drivers_license' | 'national_id';
	number: string;
	verified: boolean;
};

/**
 * VO representing a verified piece of government identification.
 */
class GovernmentIdInfo {
	private constructor(private readonly props: GovernmentIdInfoProps) {}

	public static create(props: GovernmentIdInfoProps): { success: true; value: GovernmentIdInfo } | { success: false; error: string } {
		if (!props.number) {
			return { success: false, error: 'ID number cannot be empty.' };
		}
		return { success: true, value: new GovernmentIdInfo(props) };
	}

	public isVerified(): boolean {
		return this.props.verified;
	}
}

type CandidateInfoProps = {
	dateOfBirth: Date;
};

/**
 * VO representing the candidate's personal information.
 */
class CandidateInfo {
	private constructor(private readonly props: CandidateInfoProps) {}

	public static create(props: CandidateInfoProps): { success: true; value: CandidateInfo } | { success: false; error: string } {
		if (props.dateOfBirth > new Date()) {
			return { success: false, error: 'Date of birth cannot be in the future.' };
		}
		return { success: true, value: new CandidateInfo(props) };
	}

	public getAge(): number {
		const today = new Date();
		const birthDate = new Date(this.props.dateOfBirth);
		let age = today.getFullYear() - birthDate.getFullYear();
		const m = today.getMonth() - birthDate.getMonth();
		if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
			age--;
		}
		return age;
	}
}

type GuardianSignature = {
	guardianName: string;
	signatureDate: Date;
};

type FeeStructureProps = {
	monthlyDues: number;
	enrollmentFee: number;
	penalties: {
		type: string;
		amount: number;
	}[];
};

/**
 * VO representing the contract's fee structure.
 */
class FeeStructure {
	private constructor(private readonly props: FeeStructureProps) {}

	public static create(props: FeeStructureProps): { success: true; value: FeeStructure } | { success: false; error: string } {
		if (props.monthlyDues < 0 || props.enrollmentFee < 0) {
			return { success: false, error: 'Fees cannot be negative.' };
		}
		if (!props.penalties) {
			return { success: false, error: 'Penalties must be defined, even if empty.' };
		}
		return { success: true, value: new FeeStructure(props) };
	}

	public get monthlyDues(): number {
		return this.props.monthlyDues;
	}

	public get enrollmentFee(): number {
		return this.props.enrollmentFee;
	}
}

type PrepareResult = { success: true; draft: ContractDraft } | { success: false; error: string };

type PrepareContractDraftProps = {
	candidateId: string;
	identification: GovernmentIdInfoProps;
	candidateInfo: CandidateInfoProps;
	fees: FeeStructureProps;
	guardianSignature?: GuardianSignature;
};

type ContractDraftProps = {
	candidateId: string;
	identification: GovernmentIdInfo;
	candidateInfo: CandidateInfo;
	fees: FeeStructure;
	guardianSignature?: GuardianSignature;
};

/**
 * Represents the initial stage of a contract, where information is gathered and validated.
 * This corresponds to the "Contract Prepared" phase in the contracting process.
 * It ensures all prerequisites and rules are met before a contract can be signed by a customer.
 *
 * @remarks
 * Invariants:
 * 1. Identification rule - Contract must include verified government ID information of the customer.
 * 2. Age verification rule - Customer must meet minimum age requirements (18+) or have guardian co-signature for minors.
 * 3. Fee structure rule - All fees (including monthly dues, enrollment fees, and potential penalties) must be clearly itemized.
 */
export class ContractDraft {
	private readonly candidateId: string;
	private readonly identification: GovernmentIdInfo;
	private readonly candidateInfo: CandidateInfo;
	private readonly guardianSignature?: GuardianSignature;
	private readonly fees: FeeStructure;

	private constructor(props: ContractDraftProps) {
		this.candidateId = props.candidateId;
		this.identification = props.identification;
		this.candidateInfo = props.candidateInfo;
		this.fees = props.fees;
		this.guardianSignature = props.guardianSignature;
	}

	public static prepare(props: PrepareContractDraftProps): PrepareResult {
		const idResult = GovernmentIdInfo.create(props.identification);
		if (!idResult.success) return idResult;
		const identification = idResult.value;

		const candidateInfoResult = CandidateInfo.create(props.candidateInfo);
		if (!candidateInfoResult.success) return candidateInfoResult;
		const candidateInfo = candidateInfoResult.value;

		const feesResult = FeeStructure.create(props.fees);
		if (!feesResult.success) return feesResult;
		const fees = feesResult.value;

		// --- Enforce Aggregate-level Invariants ---

		// 1. Identification rule
		if (!identification.isVerified()) {
			return { success: false, error: 'Government ID is not verified.' };
		}

		// 2. Age verification rule
		const age = candidateInfo.getAge();
		const isMinor = age < 18;
		// A minor (under 18) must have a guardian's co-signature to proceed.
		if (isMinor && !props.guardianSignature) {
			return { success: false, error: 'Candidate is a minor and a guardian co-signature is required.' };
		}

		// The fee structure rule is already enforced by the FeeStructure VO creation.

		const draft = new ContractDraft({
			candidateId: props.candidateId,
			identification,
			candidateInfo,
			fees,
			guardianSignature: props.guardianSignature,
		});
		return { success: true, draft };
	}

	public getCandidateId(): string {
		return this.candidateId;
	}

	public getIdentification(): GovernmentIdInfo {
		return this.identification;
	}

	public getFees(): FeeStructure {
		return this.fees;
	}

	public getCandidateInfo(): CandidateInfo {
		return this.candidateInfo;
	}
}
