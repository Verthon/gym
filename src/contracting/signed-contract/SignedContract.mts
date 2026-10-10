import type { LocalDate } from "#/utils/LocalDate.mts";
import { PersonId } from "../draft/PersonId.mts";
import { FeeStructure } from "#/money/FeeStructure.mts";
import {
  paymentConfirmed,
  paymentFailed,
  contractActivated,
  type SignedContractEvent,
} from "./events.mts";

export type SignedContractProps = {
  personId: PersonId;
  fees: FeeStructure;
};

type SignedState =
  | { kind: "AwaitingPayment" }
  | { kind: "PaymentAccepted"; paymentRef: string }
  | { kind: "PaymentRejected"; reason?: string }
  | { kind: "Active" };

export class SignedContract {
  private props: SignedContractProps;
  private events: SignedContractEvent[] = [];
  private state: SignedState = { kind: "AwaitingPayment" };

  private constructor(props: SignedContractProps) {
    this.props = props;
  }

  public static create(props: SignedContractProps): SignedContract {
    return new SignedContract(props);
  }

  public toActiveContract(at: LocalDate) {
    if (this.state.kind !== "PaymentAccepted") return;
    this.state = { kind: "Active" };
    this.events.push(
      contractActivated(
        {
          personId: this.props.personId,
          fees: this.props.fees,
        },
        at
      )
    );
  }

  public recordPaymentAccepted(args: { paymentRef: string; at: LocalDate }) {
    if (this.state.kind !== "AwaitingPayment") return;
    this.state = { kind: "PaymentAccepted", paymentRef: args.paymentRef };
    this.events.push(
      paymentConfirmed(
        {
          personId: this.props.personId,
          paymentRef: args.paymentRef,
        },
        args.at
      )
    );
  }

  public recordPaymentRejected(args: { reason?: string; at: LocalDate }) {
    if (this.state.kind !== "AwaitingPayment") return;
    this.state = { kind: "PaymentRejected", reason: args.reason };
    this.events.push(
      paymentFailed(
        {
          personId: this.props.personId,
          reason: args.reason,
        },
        args.at
      )
    );
  }

  public pullEvents(): SignedContractEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }
}
