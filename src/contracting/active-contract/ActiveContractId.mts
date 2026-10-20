import { err, ok, type Result } from "#/utils/Result.mts";

export type ActiveContractIdError = { code: "EMPTY" };

export class ActiveContractId {
  private readonly value: string;

  private constructor(value: string) {
    this.value = value;
  }

  static create(input: string | null | undefined): Result<ActiveContractId, ActiveContractIdError> {
    const v = input?.trim();
    if (!v) return err({ code: "EMPTY" });
    return ok(new ActiveContractId(v));
  }

  public equals(other: ActiveContractId): boolean {
    return this.value === other.value;
  }

  public toString(): string {
    return this.value;
  }
}
