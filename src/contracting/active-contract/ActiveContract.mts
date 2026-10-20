import { err, okVoid, type Result } from "#/utils/Result.mts";
import { PersonId } from "../draft/PersonId.mts";
import { contractSuspended, type ContractSuspended } from "./events.mts";

export type ActiveContractProps = {
  personId: PersonId;
};

export type ActiveContractError = { code: "ALREADY_SUSPENDED" };

type ActiveState =
  | { kind: "InForce" }
  | { kind: "Suspended"; at: Temporal.Instant };

export class ActiveContract {
  private readonly props: ActiveContractProps;
  private state: ActiveState = { kind: "InForce" };
  private events: ContractSuspended[] = [];

  private constructor(props: ActiveContractProps) {
    this.props = props;
  }

  public static create(props: ActiveContractProps): ActiveContract {
    return new ActiveContract(props);
  }

  public suspend(at: Temporal.Instant): Result<void, ActiveContractError> {
    if (this.state.kind === "Suspended") return err({ code: "ALREADY_SUSPENDED" });
    this.state = { kind: "Suspended", at };
    this.events.push(
      contractSuspended(
        {
          personId: this.props.personId,
        },
        at
      )
    );
    return okVoid();
  }

  public pullEvents(): ContractSuspended[] {
    const out = this.events;
    this.events = [];
    return out;
  }
}
