import type { FeeStructure } from "#/money/FeeStructure.mts";
import type { LocalDate } from "#/utils/LocalDate.mts";
import type { PersonId } from "../draft/PersonId.mts";

export type PaymentConfirmed = Readonly<{
    type: "PaymentConfirmed";
    occurredAt: LocalDate;
    payload: Readonly<{
        personId: PersonId;
        paymentRef: string;
    }>;
}>;

export const paymentConfirmed = (
    payload: PaymentConfirmed["payload"],
    occurredAt: LocalDate
): PaymentConfirmed => ({
    type: "PaymentConfirmed",
    occurredAt,
    payload,
});

export type PaymentFailed = Readonly<{
    type: "PaymentFailed";
    occurredAt: LocalDate;
    payload: Readonly<{
        personId: PersonId;
        reason?: string;
    }>;
}>;

export const paymentFailed = (
    payload: PaymentFailed["payload"],
    occurredAt: LocalDate
): PaymentFailed => ({
    type: "PaymentFailed",
    occurredAt,
    payload,
});

export type ContractActivated = Readonly<{
    type: "ContractActivated";
    occurredAt: LocalDate;
    payload: Readonly<{
        personId: PersonId;
        fees: FeeStructure;
    }>;
}>;

export const contractActivated = (
    payload: ContractActivated["payload"],
    occurredAt: LocalDate
): ContractActivated => ({
    type: "ContractActivated",
    occurredAt,
    payload,
});

export type SignedContractEvent =
    | PaymentConfirmed
    | PaymentFailed
    | ContractActivated;
