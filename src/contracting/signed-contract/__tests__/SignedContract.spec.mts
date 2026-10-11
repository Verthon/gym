import { describe, it, expect } from "vitest";
import { PersonId } from "../../draft/PersonId.mts";
import { SignedContract } from "../SignedContract.mts";
import { FeeStructure } from "#/money/FeeStructure.mts";
import { MonthlyDues } from "#/money/MonthlyDues.mts";
import { Money } from "#/money/Money.mts";
import { EnrollmentFee } from "#/money/EnrollmentFee.mts";
import { success } from "#/utils/test.mts";

const at = Temporal.Instant.from("2025-09-13T10:00:00Z");

describe("SignedContract - success paths", () => {
    it("records accepted payment and transitions to active contract", () => {
        const personId = success(PersonId.create("person-123"));
        const monthly = success(
            MonthlyDues.create(success(Money.fromMajor("10.00", "EUR")))
        );
        const enrollment = success(
            EnrollmentFee.create(success(Money.fromMajor("99.00", "EUR")))
        );
        const fees = success(FeeStructure.create(monthly, enrollment, []));
        const signedContract = SignedContract.create({ personId, fees });

        signedContract.recordPaymentAccepted({ paymentRef: "PAY-12345", at });
        
        const eventsAfterPayment = signedContract.pullEvents();
        expect(eventsAfterPayment).toEqual([
            {
                occurredAt: at,
                payload: {
                    personId: {
                        value: "person-123",
                    },
                    paymentRef: "PAY-12345",
                },
                type: "PaymentConfirmed",
            },
        ]);

        signedContract.toActiveContract(at);
        
        const eventsAfterActivation = signedContract.pullEvents();
        expect(eventsAfterActivation).toEqual([
            {
                occurredAt: at,
                payload: {
                    personId: {
                        value: "person-123",
                    },
                    fees: expect.objectContaining({
                        enrollmentFee: expect.any(Object),
                        monthlyDues: expect.any(Object),
                    }),
                },
                type: "ContractActivated",
            },
        ]);
    });

    it("records rejected payment with reason", () => {
        const personId = success(PersonId.create("person-456"));
        const monthly = success(
            MonthlyDues.create(success(Money.fromMajor("20.00", "EUR")))
        );
        const enrollment = success(
            EnrollmentFee.create(success(Money.fromMajor("50.00", "EUR")))
        );
        const fees = success(FeeStructure.create(monthly, enrollment, []));
        const signedContract = SignedContract.create({ personId, fees });

        signedContract.recordPaymentRejected({ reason: "Insufficient funds", at });

        expect(signedContract.pullEvents()).toEqual([
            {
                occurredAt: at,
                payload: {
                    personId: {
                        value: "person-456",
                    },
                    reason: "Insufficient funds",
                },
                type: "PaymentFailed",
            },
        ]);
    });
});

describe("SignedContract - validation", () => {
    it("does not activate contract without accepted payment", () => {
        const personId = success(PersonId.create("person-789"));
        const monthly = success(
            MonthlyDues.create(success(Money.fromMajor("15.00", "EUR")))
        );
        const enrollment = success(
            EnrollmentFee.create(success(Money.fromMajor("75.00", "EUR")))
        );
        const fees = success(FeeStructure.create(monthly, enrollment, []));
        const signedContract = SignedContract.create({ personId, fees });

        signedContract.toActiveContract(at);

        expect(signedContract.pullEvents()).toEqual([]);
    });

    it("does not activate contract after rejected payment", () => {
        const personId = success(PersonId.create("person-999"));
        const monthly = success(
            MonthlyDues.create(success(Money.fromMajor("25.00", "EUR")))
        );
        const enrollment = success(
            EnrollmentFee.create(success(Money.fromMajor("100.00", "EUR")))
        );
        const fees = success(FeeStructure.create(monthly, enrollment, []));
        const signedContract = SignedContract.create({ personId, fees });

        signedContract.recordPaymentRejected({ reason: "Card declined", at });
        signedContract.toActiveContract(at);

        const events = signedContract.pullEvents();
        expect(events).toHaveLength(1);
        expect(events[0]?.type).toBe("PaymentFailed");
    });
});
