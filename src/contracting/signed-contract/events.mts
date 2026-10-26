import type { FeeStructure } from "#/money/FeeStructure.mts";
import type { LocalDate } from "#/utils/LocalDate.mts";
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

export type ContractStarted = Readonly<{
    type: "ContractStarted";
    occurredAt: Temporal.Instant;
    payload: Readonly<{
        personId: PersonId;
        fees: FeeStructure;
        startDate: LocalDate;
        endDate: LocalDate;
    }>;
}>;

export const contractStarted = (
    payload: ContractStarted["payload"],
    occurredAt: Temporal.Instant
): ContractStarted => ({
    type: "ContractStarted",
    occurredAt,
    payload,
});

export type SignedContractEvent =
    | PaymentConfirmed
    | PaymentFailed
    | ContractStarted;
