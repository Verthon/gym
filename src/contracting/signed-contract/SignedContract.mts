import { err, okVoid, type Result } from "#/utils/Result.mts";
import { PersonId } from "../draft/PersonId.mts";
import type { LocalDate } from "#/utils/LocalDate.mts";
import { FeeStructure } from "#/money/FeeStructure.mts";
import {
  paymentConfirmed,
  paymentFailed,
  contractStarted,
  type SignedContractEvent,
} from "./events.mts";

export type SignedContractProps = {
  personId: PersonId;
  fees: FeeStructure;
  durationInMonths: number;
};

export type SignedContractError =
  | { code: "NOT_AWAITING_PAYMENT" }
  | { code: "PAYMENT_NOT_ACCEPTED" };

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

  public toActiveContract(
    at: Temporal.Instant,
    startDate: LocalDate
  ): Result<void, SignedContractError> {
    if (this.state.kind !== "PaymentAccepted")
      return err({ code: "PAYMENT_NOT_ACCEPTED" });
    this.state = { kind: "Active" };
    this.events.push(
      contractStarted(
        {
          personId: this.props.personId,
          fees: this.props.fees,
          startDate,
          endDate: startDate.plusMonths(this.props.durationInMonths),
        },
        at
      )
    );
    return okVoid();
  }

  public recordPaymentAccepted(args: {
    paymentRef: string;
    at: Temporal.Instant;
  }): Result<void, SignedContractError> {
    if (this.state.kind !== "AwaitingPayment")
      return err({ code: "NOT_AWAITING_PAYMENT" });
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
    return okVoid();
  }

  public recordPaymentRejected(args: {
    reason?: string;
    at: Temporal.Instant;
  }): Result<void, SignedContractError> {
    if (this.state.kind !== "AwaitingPayment")
      return err({ code: "NOT_AWAITING_PAYMENT" });
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
    return okVoid();
  }

  public pullEvents(): SignedContractEvent[] {
    const out = this.events;
    this.events = [];
    return out;
  }
}
