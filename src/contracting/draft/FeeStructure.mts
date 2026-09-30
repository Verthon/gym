import type { Result } from "#/utils/Result.mts";

export type FeeStructureProps = {
	monthlyDues: number;
	enrollmentFee: number;
	maintenanceFee?: number;
};

/**
 * VO representing the fee structure for a contract.
 */
export class FeeStructure {
	private readonly monthlyDues: number;
	private readonly enrollmentFee: number;
	private readonly maintenanceFee: number;

	private constructor(props: FeeStructureProps) {
		this.monthlyDues = props.monthlyDues;
		this.enrollmentFee = props.enrollmentFee;
		this.maintenanceFee = props.maintenanceFee ?? 0;
	}

	public static create(props: FeeStructureProps): Result<FeeStructure, string> {
		if (props.monthlyDues < 0) return { success: false, error: "Monthly dues cannot be negative" };
		if (props.enrollmentFee < 0) return { success: false, error: "Enrollment fee cannot be negative" };
		if (props.maintenanceFee && props.maintenanceFee < 0) {
			return { success: false, error: "Maintenance fee cannot be negative" };
		}

		return { success: true, value: new FeeStructure(props) };
	}

	getTotalInitialFee(): number {
		return this.enrollmentFee + this.maintenanceFee;
	}

	getMonthlyDues(): number {
		return this.monthlyDues;
	}
}
