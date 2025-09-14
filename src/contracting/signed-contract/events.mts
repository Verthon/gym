import type { FeeStructure } from "@/money/FeeStructure.mjs";
import { LocalDate } from "@/utils/LocalDate.mjs";
import type { PersonId } from "../draft/PersonId.mjs";
import type { DomainEvent } from "@/events/event.mjs";

export type ContractSigned = Readonly<{
    type: "ContractSigned";
    occurredAt: LocalDate;
    payload: Readonly<{
        personId: PersonId;
        fees: FeeStructure;
    }>;
}>;

export const contractSigned = (
    payload: ContractSigned["payload"],
    occurredAt: LocalDate = LocalDate.today()
): ContractSigned => ({
    type: "ContractSigned",
    occurredAt,
    payload,
});

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
    occurredAt: LocalDate = LocalDate.today()
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
    occurredAt: LocalDate = LocalDate.today()
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
    occurredAt: LocalDate = LocalDate.today()
): ContractActivated => ({
    type: "ContractActivated",
    occurredAt,
    payload,
});

export const toGenericEvent = (
    e: ContractSigned | PaymentConfirmed | PaymentFailed | ContractActivated
): DomainEvent<"ContractSigned" | "PaymentConfirmed" | "PaymentFailed" | "ContractActivated", any> => ({
    type: e.type,
    occurredAt: e.occurredAt.toISO(),
    payload: e.payload,
});

