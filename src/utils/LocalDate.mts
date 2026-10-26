export class LocalDate {
	private readonly value: Temporal.PlainDate;

	private constructor(value: Temporal.PlainDate) {
		this.value = value;
	}

	public static fromISO(input: string): LocalDate {
		return new LocalDate(Temporal.PlainDate.from(input));
	}

	public static fromInstant(at: Temporal.Instant, timeZone: string): LocalDate {
		return new LocalDate(at.toZonedDateTimeISO(timeZone).toPlainDate());
	}

	public isBefore(other: LocalDate): boolean {
		return Temporal.PlainDate.compare(this.value, other.value) < 0;
	}

	public isAfter(other: LocalDate): boolean {
		return Temporal.PlainDate.compare(this.value, other.value) > 0;
	}

	public plusDays(days: number): LocalDate {
		return new LocalDate(this.value.add({ days }));
	}

	public plusMonths(months: number): LocalDate {
		return new LocalDate(this.value.add({ months }));
	}

	public toISO(): string {
		return this.value.toString();
	}

	public toPlainDate(): Temporal.PlainDate {
		return this.value;
	}

	public equals(other: LocalDate): boolean {
		return this.value.equals(other.value);
	}
}
