import type { LocalDate } from "@/utils/LocalDate.mjs";
import { err, okVoid, type Result } from "@/utils/Result.mjs";
import type { PersonId } from "../draft/PersonId.mjs";
import type { FeeStructure } from "@/money/FeeStructure.mjs";
import type { DomainEvent } from "@/events/event.mjs";
import { contractSigned, toGenericEvent } from "./events.mjs";

type UnsignedState =
  | { kind: "Pending" }
  | { kind: "ConfirmedBySales"; at: LocalDate }
  | { kind: "AcceptedByCustomer"; at: LocalDate }
  | { kind: "Signed"; at: LocalDate };

type UnsignedContractProps = {
  personId: PersonId;
  fees: FeeStructure;
};

export class UnsignedContract {
  private props: UnsignedContractProps;
  private state: UnsignedState = { kind: "Pending" };
  private events: DomainEvent[] = [];

  private constructor(props: UnsignedContractProps) {
    this.props = props;
  }

  public static create(props: UnsignedContractProps): UnsignedContract {
    return new UnsignedContract(props);
  }

  public confirmServiceCommitmentBySalesSpecialist(
    at: LocalDate
  ): Result<void, "INVALID_STATE"> {
    switch (this.state.kind) {
      case "Pending":
        this.state = { kind: "ConfirmedBySales", at };
        return okVoid();
      case "AcceptedByCustomer":
        this.state = { kind: "Signed", at };
        this.events.push(
          toGenericEvent(
            contractSigned(
              {
                personId: this.props.personId,
                fees: this.props.fees,
              },
              at
            )
          )
        );
        return okVoid();
      default:
        return err("INVALID_STATE");
    }
  }

  public acceptTermsAndConditionsByCustomer(
    at: LocalDate
  ): Result<void, "INVALID_STATE"> {
    switch (this.state.kind) {
      case "Pending":
        this.state = { kind: "AcceptedByCustomer", at };
        return okVoid();
      case "ConfirmedBySales":
        this.state = { kind: "Signed", at };
        return okVoid();
      default:
        return err("INVALID_STATE");
    }
  }

  public toSignedContract() {
    if (this.state.kind !== "Signed") {
      return err({ code: "NOT_FULLY_SIGNED" });
    }

    this.events.push(
      toGenericEvent(
        contractSigned(
          {
            personId: this.props.personId,
            fees: this.props.fees,
          },
          this.state.at
        )
      )
    );

    return okVoid();
  }

  public pullEvents(): DomainEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }
}
