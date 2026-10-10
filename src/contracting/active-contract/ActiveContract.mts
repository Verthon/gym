import type { LocalDate } from "#/utils/LocalDate.mts";
import { PersonId } from "../draft/PersonId.mts";
import { contractSuspended, type ContractSuspended } from "./events.mts";

export type ActiveContractProps = {
  personId: PersonId;
};

export class ActiveContract {
  private readonly props: ActiveContractProps;
  private events: ContractSuspended[] = [];

  private constructor(props: ActiveContractProps) {
    this.props = props;
  }

  public static create(props: ActiveContractProps): ActiveContract {
    return new ActiveContract(props);
  }

  public suspend(at: LocalDate) {
    this.events.push(
      contractSuspended(
        {
          personId: this.props.personId,
        },
        at
      )
    );
  }

  public pullEvents(): ContractSuspended[] {
    const out = this.events;
    this.events = [];
    return out;
  }
}
