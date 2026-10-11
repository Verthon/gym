import type { FeeStructure } from "#/money/FeeStructure.mts";
import type { PersonId } from "../draft/PersonId.mts";

export type PaymentConfirmed = Readonly<{
    type: "PaymentConfirmed";
    occurredAt: Temporal.Instant;
    payload: Readonly<{
        personId: PersonId;
        paymentRef: string;
    }>;
}>;

export const paymentConfirmed = (
    payload: PaymentConfirmed["payload"],
    occurredAt: Temporal.Instant
): PaymentConfirmed => ({
    type: "PaymentConfirmed",
    occurredAt,
    payload,
});

export type PaymentFailed = Readonly<{
    type: "PaymentFailed";
    occurredAt: Temporal.Instant;
    payload: Readonly<{
        personId: PersonId;
        reason?: string;
    }>;
}>;

export const paymentFailed = (
    payload: PaymentFailed["payload"],
    occurredAt: Temporal.Instant
): PaymentFailed => ({
    type: "PaymentFailed",
    occurredAt,
    payload,
});

export type ContractActivated = Readonly<{
    type: "ContractActivated";
    occurredAt: Temporal.Instant;
    payload: Readonly<{
        personId: PersonId;
        fees: FeeStructure;
    }>;
}>;

export const contractActivated = (
    payload: ContractActivated["payload"],
    occurredAt: Temporal.Instant
): ContractActivated => ({
    type: "ContractActivated",
    occurredAt,
    payload,
});

export type SignedContractEvent =
    | PaymentConfirmed
    | PaymentFailed
    | ContractActivated;
