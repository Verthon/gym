import { describe, it, expect } from "vitest";

import { UnsignedContract } from "../UnsignedContract.mts";
import { PersonId } from "../../draft/PersonId.mts";
import { failWith, success } from "#/utils/test.mts";
import { FeeStructure } from "#/money/FeeStructure.mts";
import { MonthlyDues } from "#/money/MonthlyDues.mts";
import { Money } from "#/money/Money.mts";
import { EnrollmentFee } from "#/money/EnrollmentFee.mts";

const at = Temporal.Instant.from("2025-09-13T10:00:00Z");

const applicantId = success(PersonId.create("applicant-1"));
const monthly = success(
  MonthlyDues.create(success(Money.fromMajor("10.00", "EUR")))
);
const enrollment = success(
  EnrollmentFee.create(success(Money.fromMajor("99.00", "EUR")))
);
const fees = success(FeeStructure.create(monthly, enrollment, []));

describe("UnsignedContract - success paths", () => {

  it("transitions to a signed contract when both parties sign", () => {
    const unsignedContract = UnsignedContract.create({
      fees,
      personId: applicantId,
    });


    unsignedContract.confirmServiceCommitmentBySalesSpecialist(at);
    unsignedContract.acceptTermsAndConditionsByCustomer(at);
    const promotion = unsignedContract.toSignedContract();
    expect(promotion).toEqual({ success: true, value: undefined });
    expect(unsignedContract.pullEvents()).toEqual([
      {
        occurredAt: at,
        payload: {
          fees: {
            enrollmentFee: {
              amount: {
                amountMinor: 9900,
                currency: "EUR",
              },
            },
            monthlyDues: {
              amount: {
                amountMinor: 1000,
                currency: "EUR",
              },
            },
            penaltyFees: [],
          },
          personId: {
            value: "applicant-1",
          },
        },
        type: "ContractSigned",
      },
    ]);
  });

  it("emits ContractSigned once, at the second signature, when the customer accepts first", () => {
    const acceptedAt = Temporal.Instant.from("2025-09-13T10:00:00Z");
    const confirmedAt = Temporal.Instant.from("2025-09-14T10:00:00Z");
    const unsignedContract = UnsignedContract.create({
      fees,
      personId: applicantId,
    });

    unsignedContract.acceptTermsAndConditionsByCustomer(acceptedAt);
    unsignedContract.confirmServiceCommitmentBySalesSpecialist(confirmedAt);
    unsignedContract.toSignedContract();

    const events = unsignedContract.pullEvents();
    expect(events.map((e) => e.type)).toEqual(["ContractSigned"]);
    expect(events[0]?.occurredAt).toEqual(confirmedAt);
  });

  it("does not emit ContractSigned again when promoted twice", () => {
    const unsignedContract = UnsignedContract.create({
      fees,
      personId: applicantId,
    });

    unsignedContract.confirmServiceCommitmentBySalesSpecialist(at);
    unsignedContract.acceptTermsAndConditionsByCustomer(at);
    unsignedContract.toSignedContract();
    unsignedContract.toSignedContract();

    expect(unsignedContract.pullEvents()).toHaveLength(1);
  });
});

describe("UnsignedContract - validation failures", () => {
  it("should not transition to the signed contract when missing the accept of terms", () => {
    const unsignedContract = UnsignedContract.create({
      fees,
      personId: applicantId,
    });


    unsignedContract.confirmServiceCommitmentBySalesSpecialist(at);

    const promotion = unsignedContract.toSignedContract();
    failWith(promotion, "NOT_FULLY_SIGNED");
    expect(unsignedContract.pullEvents()).toEqual([]);
  });

  it("should not transition to the signed contract when missing the service commitment approval from Sales Specialist", () => {
    const unsignedContract = UnsignedContract.create({
      fees,
      personId: applicantId,
    });


    unsignedContract.acceptTermsAndConditionsByCustomer(at);

    const promotion = unsignedContract.toSignedContract();
    failWith(promotion, "NOT_FULLY_SIGNED");
    expect(unsignedContract.pullEvents()).toEqual([]);
  });
});
