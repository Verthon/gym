import { describe, it, expect } from "vitest";

import { UnsignedContract } from "../UnsignedContract.mts";
import { PersonId } from "../../draft/PersonId.mts";
import { failWith, success } from "#/utils/test.mts";
import { FeeStructure } from "#/money/FeeStructure.mts";
import { MonthlyDues } from "#/money/MonthlyDues.mts";
import { Money } from "#/money/Money.mts";
import { EnrollmentFee } from "#/money/EnrollmentFee.mts";
import { LocalDate } from "#/utils/LocalDate.mts";

const today = LocalDate.fromISO("2025-09-13");

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


    unsignedContract.confirmServiceCommitmentBySalesSpecialist(today);
    unsignedContract.acceptTermsAndConditionsByCustomer(today);
    const promotion = unsignedContract.toSignedContract();
    expect(promotion).toEqual({ success: true, value: undefined });
    expect(unsignedContract.pullEvents()).toEqual([
      {
        occurredAt: LocalDate.fromISO("2025-09-13"),
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
});

describe("UnsignedContract - validation failures", () => {
  it("should not transition to the signed contract when missing the accept of terms", () => {
    const unsignedContract = UnsignedContract.create({
      fees,
      personId: applicantId,
    });


    unsignedContract.confirmServiceCommitmentBySalesSpecialist(today);

    const promotion = unsignedContract.toSignedContract();
    failWith(promotion, "NOT_FULLY_SIGNED");
    expect(unsignedContract.pullEvents()).toEqual([]);
  });

  it("should not transition to the signed contract when missing the service commitment approval from Sales Specialist", () => {
    const unsignedContract = UnsignedContract.create({
      fees,
      personId: applicantId,
    });


    unsignedContract.acceptTermsAndConditionsByCustomer(today);

    const promotion = unsignedContract.toSignedContract();
    failWith(promotion, "NOT_FULLY_SIGNED");
    expect(unsignedContract.pullEvents()).toEqual([]);
  });
});
