import { LocalDate } from "@/utils/LocalDate.mjs";

type BirthDateError = { code: "IN_FUTURE"; context: { birthDate: LocalDate } };

export class BirthDate {
  private readonly date: LocalDate;

  private constructor(date: LocalDate) {
    this.date = date;
  }

  static create(
    birthDate: LocalDate
  ):
    | { success: true; value: BirthDate }
    | { success: false; error: BirthDateError } {
    const today = LocalDate.today();
    // Fail-fast: birth date cannot be in the future
    if (birthDate.isAfter(today)) {
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
    const a = asOf.toJSDate();
    const b = this.date.toJSDate();
    let years = a.getUTCFullYear() - b.getUTCFullYear();
    const monthAhead =
      a.getUTCMonth() > b.getUTCMonth() ||
      (a.getUTCMonth() === b.getUTCMonth() && a.getUTCDate() >= b.getUTCDate());
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