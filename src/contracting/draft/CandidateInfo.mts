import type { Result } from "../../utils/Result.js";

export type CandidateInfoProps = {
	dateOfBirth: Date;
	email: string;
	name: string;
};

/**
 * VO for candidate's personal information.
 */
export class CandidateInfo {
	private readonly dateOfBirth: Date;
	private readonly email: string;
	private readonly name: string;

	private constructor(props: CandidateInfoProps) {
		this.dateOfBirth = props.dateOfBirth;
		this.email = props.email;
		this.name = props.name;
	}

	public static create(props: CandidateInfoProps): Result<CandidateInfo, string> {
		if (!props.name) return { success: false, error: "Name is required" };
		if (!props.email) return { success: false, error: "Email is required" };
		// Basic email format validation
		if (!/\S+@\S+\.\S+/.test(props.email)) {
			return { success: false, error: "Invalid email format" };
		}

		return { success: true, value: new CandidateInfo(props) };
	}

	getAge(): number {
		const today = new Date();
		const birthDate = new Date(this.dateOfBirth);
		let age = today.getFullYear() - birthDate.getFullYear();
		const m = today.getMonth() - birthDate.getMonth();
		if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
			age--;
		}
		return age;
	}
}
