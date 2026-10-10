import type { LocalDate } from "#/utils/LocalDate.mts";

type GovernmentIdType = "PASSPORT" | "ID_CARD" | "TEST_ID";

type GovernmentIdInfoProps = {
	type: GovernmentIdType;
	number: string;
	country?: string;
	expiryDate?: LocalDate;
};

type GovernmentIdInfoError =
	| { code: "INVALID_TYPE"; context: { type: string } }
	| { code: "INVALID_NUMBER"; context: { number: string } }
	| { code: "EXPIRED"; context: { expiryDate: LocalDate } };

export class GovernmentIdInfo {
	private readonly props: GovernmentIdInfoProps;

	private constructor(props: GovernmentIdInfoProps) {
		this.props = { ...props };
	}

	public static create(
		props: GovernmentIdInfoProps,
		asOf: LocalDate
	):
		| { success: true; value: GovernmentIdInfo }
		| { success: false; error: GovernmentIdInfoError } {
		if (!["PASSPORT", "ID_CARD", "TEST_ID"].includes(props.type)) {
			return {
				success: false,
				error: { code: "INVALID_TYPE", context: { type: props.type } },
			};
		}
		if (!props.number || props.number.length < 3) {
			return {
				success: false,
				error: { code: "INVALID_NUMBER", context: { number: props.number } },
			};
		}
		if (props.expiryDate && props.expiryDate.isBefore(asOf)) {
			return {
				success: false,
				error: { code: "EXPIRED", context: { expiryDate: props.expiryDate } },
			};
		}
		return { success: true, value: new GovernmentIdInfo(props) };
	}

	public equals(other: GovernmentIdInfo): boolean {
		const sameExpiry =
			(!this.props.expiryDate && !other.props.expiryDate) ||
			(!!this.props.expiryDate &&
				!!other.props.expiryDate &&
				this.props.expiryDate.equals(other.props.expiryDate));
		return (
			this.props.type === other.props.type &&
			this.props.number === other.props.number &&
			this.props.country === other.props.country &&
			sameExpiry
		);
	}

	public getType(): GovernmentIdType {
		return this.props.type;
	}

	public getNumber(): string {
		return this.props.number;
	}

	public getCountry(): string | undefined {
		return this.props.country;
	}

	public getExpiryDate(): LocalDate | undefined {
		return this.props.expiryDate;
	}
}
