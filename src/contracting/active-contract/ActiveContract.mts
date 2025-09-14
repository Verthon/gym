import { PersonId } from "../draft/PersonId.mjs";
import { type DomainEvent } from "@/events/event.mjs";
import { contractSuspended, toGenericEvent } from "./events.mjs";

export type ActiveContractProps = {
  personId: PersonId;
};

export class ActiveContract {
  private props: ActiveContractProps;
  private events: DomainEvent[] = [];

  private constructor(props: ActiveContractProps) {
    this.props = props;
  }

  public static create(props: ActiveContractProps): ActiveContract {
    return new ActiveContract(props);
  }

  public suspend() {
    this.events.push(
      toGenericEvent(
        contractSuspended({
          personId: this.props.personId,
        })
      )
    );
  }

  public pullEvents(): DomainEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }
}
