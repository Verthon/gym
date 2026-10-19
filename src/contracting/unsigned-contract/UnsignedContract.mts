import { err, okVoid, type Result } from "#/utils/Result.mts";
import type { PersonId } from "../draft/PersonId.mts";
import type { FeeStructure } from "#/money/FeeStructure.mts";
import { contractSigned, type ContractSigned } from "./events.mts";

type UnsignedState =
  | { kind: "Pending" }
  | { kind: "ConfirmedBySales"; at: Temporal.Instant }
  | { kind: "AcceptedByCustomer"; at: Temporal.Instant }
  | { kind: "Signed"; at: Temporal.Instant };

type UnsignedContractProps = {
  personId: PersonId;
  fees: FeeStructure;
};

export class UnsignedContract {
  private props: UnsignedContractProps;
  private state: UnsignedState = { kind: "Pending" };
  private events: ContractSigned[] = [];

  private constructor(props: UnsignedContractProps) {
    this.props = props;
  }

  public static create(props: UnsignedContractProps): UnsignedContract {
    return new UnsignedContract(props);
  }

  public confirmServiceCommitmentBySalesSpecialist(
    at: Temporal.Instant
  ): Result<void, "INVALID_STATE"> {
    switch (this.state.kind) {
      case "Pending":
        this.state = { kind: "ConfirmedBySales", at };
        return okVoid();
      case "AcceptedByCustomer":
        this.sign(at);
        return okVoid();
      default:
        return err("INVALID_STATE");
    }
  }

  public acceptTermsAndConditionsByCustomer(
    at: Temporal.Instant
  ): Result<void, "INVALID_STATE"> {
    switch (this.state.kind) {
      case "Pending":
        this.state = { kind: "AcceptedByCustomer", at };
        return okVoid();
      case "ConfirmedBySales":
        this.sign(at);
        return okVoid();
      default:
        return err("INVALID_STATE");
    }
  }

  public toSignedContract() {
    if (this.state.kind !== "Signed") {
      return err({ code: "NOT_FULLY_SIGNED" });
    }

    return okVoid();
  }

  private sign(at: Temporal.Instant) {
    this.state = { kind: "Signed", at };
    this.events.push(
      contractSigned(
        {
          personId: this.props.personId,
          fees: this.props.fees,
        },
        at
      )
    );
  }

  public pullEvents(): ContractSigned[] {
    const out = this.events;
    this.events = [];
    return out;
  }
}
