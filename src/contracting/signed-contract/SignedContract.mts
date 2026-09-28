import { PersonId } from "../draft/PersonId.mjs";
import { FeeStructure } from "@/money/FeeStructure.mjs";
import {
  paymentConfirmed,
  paymentFailed,
  contractActivated,
  type SignedContractEvent,
} from "./events.mjs";

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

  public toActiveContract() {
    if (this.state.kind !== "PaymentAccepted") return;
    this.state = { kind: "Active" };
    this.events.push(
      contractActivated({
        personId: this.props.personId,
        fees: this.props.fees,
      })
    );
  }

  public recordPaymentAccepted(args: { paymentRef: string }) {
    if (this.state.kind !== "AwaitingPayment") return;
    this.state = { kind: "PaymentAccepted", paymentRef: args.paymentRef };
    this.events.push(
      paymentConfirmed({
        personId: this.props.personId,
        paymentRef: args.paymentRef,
      })
    );
  }

  public recordPaymentRejected(args: { reason?: string }) {
    if (this.state.kind !== "AwaitingPayment") return;
    this.state = { kind: "PaymentRejected", reason: args.reason };
    this.events.push(
      paymentFailed({
        personId: this.props.personId,
        reason: args.reason,
      })
    );
  }

  public pullEvents(): SignedContractEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }
}
