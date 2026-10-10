import type { LocalDate } from "#/utils/LocalDate.mts";

type BirthDateError = { code: "IN_FUTURE"; context: { birthDate: LocalDate } };

export class BirthDate {
  private readonly date: LocalDate;

  private constructor(date: LocalDate) {
    this.date = date;
  }

  static create(
    birthDate: LocalDate,
    asOf: LocalDate
  ):
    | { success: true; value: BirthDate }
    | { success: false; error: BirthDateError } {
    // Fail-fast: birth date cannot be in the future
    if (birthDate.isAfter(asOf)) {
      return {
        success: false,
        error: { code: "IN_FUTURE", context: { birthDate } },
      };
    }
    return { success: true, value: new BirthDate(birthDate) };
  }

  public equals(other: BirthDate): boolean {
    return this.date.equals(other.date);
  }

  public ageAsOf(asOf: LocalDate): number {
    const a = asOf.toPlainDate();
    const b = this.date.toPlainDate();
    let years = a.year - b.year;
    const monthAhead =
      a.month > b.month || (a.month === b.month && a.day >= b.day);
    if (!monthAhead) years--;
    return years < 0 ? 0 : years;
  }

  public isAtLeast(years: number, asOf: LocalDate): boolean {
    return this.ageAsOf(asOf) >= years;
  }

  public getValue(): LocalDate {
    return this.date;
  }
}