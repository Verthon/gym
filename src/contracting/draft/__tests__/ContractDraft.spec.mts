import { describe, it, expect } from "vitest";

import { LocalDate } from "#/utils/LocalDate.mts";
import { failWith, success } from "#/utils/test.mts";
import { BirthDate } from "../BirthDate.mts";
import { ContractDraft } from "../ContractDraft.mts";
import { GovernmentIdInfo } from "../GovernmentIdInfo.mts";
import { GuardianCoSignature } from "../GuardianCoSignature.mts";
import { PersonId } from "../PersonId.mts";
import { Money } from "#/money/Money.mts";
import { EnrollmentFee } from "#/money/EnrollmentFee.mts";
import { MonthlyDues } from "#/money/MonthlyDues.mts";
import { FeeStructure } from "#/money/FeeStructure.mts";

const today = LocalDate.fromISO("2025-09-13");

describe("ContractDraft - success paths", () => {

  it("creates a draft with valid invariants", () => {
    const applicantId = success(PersonId.create("applicant-1"));
    const birthDate = success(
      BirthDate.create(LocalDate.fromISO("1995-01-01"), today)
    );
    const governmentId = success(
      GovernmentIdInfo.create({
        type: "PASSPORT",
        number: "ABC123",
        country: "PL",
        expiryDate: today.plusDays(365),
      }, today)
    );

    const monthly = success(
      MonthlyDues.create(success(Money.fromMajor("10.00", "EUR")))
    );
    const enrollment = success(
      EnrollmentFee.create(success(Money.fromMajor("99.00", "EUR")))
    );
    const fees = success(FeeStructure.create(monthly, enrollment, []));

    const draft = success(
      ContractDraft.create({
        offer: { fees },
        userInfo: { personId: applicantId, birthDate, governmentId },
      })
    );

    expect(draft.status()).toBe("Draft");
    expect(success(draft.fees().firstPaymentTotal()).toMajorString()).toBe(
      "109.00"
    );
  });

  it("promotes an adult without guardian", () => {
    const personId = success(PersonId.create("adult-123"));
    const birthDate = success(
      BirthDate.create(LocalDate.fromISO("1990-01-01"), today)
    );
    const governmentId = success(
      GovernmentIdInfo.create({
        type: "ID_CARD",
        number: "ID-123",
        country: "PL",
        expiryDate: today.plusDays(30),
      }, today)
    );
    const monthly = success(
      MonthlyDues.create(success(Money.fromMajor("20.00", "EUR")))
    );
    const enrollment = success(
      EnrollmentFee.create(success(Money.fromMajor("0.00", "EUR")))
    );
    const fees = success(FeeStructure.create(monthly, enrollment, []));

    const draft = success(
      ContractDraft.create({
        offer: { fees },
        userInfo: { personId, birthDate, governmentId },
      })
    );

    const promotion = draft.toNotSignedContract(today);
    expect(promotion).toEqual({
      success: true,
      value: undefined,
    });
    expect(draft.pullEvents()).toEqual([
      {
        occurredAt: LocalDate.fromISO("2025-09-13"),
        payload: {
          fees: {
            enrollmentFee: {
              amount: {
                amountMinor: 0,
                currency: "EUR",
              },
            },
            monthlyDues: {
              amount: {
                amountMinor: 2000,
                currency: "EUR",
              },
            },
            penaltyFees: [],
          },
          personId: {
            value: "adult-123",
          },
        },
        type: "ContractPrepared",
      },
    ]);
    expect(draft.status()).toBe("ReadyToSign");
  });

  it("promotes a minor when guardian co-signs for the same minor", () => {
    const minorId = success(PersonId.create("minor-123"));
    const minorBirthDate = success(
      BirthDate.create(LocalDate.fromISO("2010-05-05"), today)
    );
    const minorGovId = success(
      GovernmentIdInfo.create({
        type: "PASSPORT",
        number: "PA-123",
        country: "PL",
        expiryDate: today.plusDays(365),
      }, today)
    );
    const monthly = success(
      MonthlyDues.create(success(Money.fromMajor("15.00", "EUR")))
    );
    const enrollment = success(
      EnrollmentFee.create(success(Money.fromMajor("50.00", "EUR")))
    );
    const fees = success(FeeStructure.create(monthly, enrollment, []));

    const draft = success(
      ContractDraft.create({
        offer: { fees },
        userInfo: {
          personId: minorId,
          birthDate: minorBirthDate,
          governmentId: minorGovId,
        },
      })
    );

    const guardianId = success(PersonId.create("guardian-1"));
    const guardianCoSignature = success(
      GuardianCoSignature.create({
        guardianId,
        minorId,
        signedAt: today,
      })
    );

    const promotion = draft.toNotSignedContract(
      today,
      guardianCoSignature
    );
    expect(promotion).toEqual({ success: true, value: undefined });
    expect(draft.status()).toBe("ReadyToSign");
  });
});

describe("ContractDraft - validation failures", () => {
  it("fails promotion for a minor without guardian", () => {
    const minorId = success(PersonId.create("minor-456"));
    const minorBirthDate = success(
      BirthDate.create(LocalDate.fromISO("2010-06-10"), today)
    );
    const minorGovId = success(
      GovernmentIdInfo.create({
        type: "ID_CARD",
        number: "MIN-001",
        country: "PL",
        expiryDate: today.plusDays(200),
      }, today)
    );
    const monthly = success(
      MonthlyDues.create(success(Money.fromMajor("12.00", "EUR")))
    );
    const enrollment = success(
      EnrollmentFee.create(success(Money.fromMajor("30.00", "EUR")))
    );
    const fees = success(FeeStructure.create(monthly, enrollment, []));

    const draft = success(
      ContractDraft.create({
        offer: { fees },
        userInfo: {
          personId: minorId,
          birthDate: minorBirthDate,
          governmentId: minorGovId,
        },
      })
    );

    const result = draft.toNotSignedContract(today);
    failWith(result, "MINOR_REQUIRES_GUARDIAN");
  });

  it("fails promotion when guardian refers to a different minor", () => {
    const minorId = success(PersonId.create("minor-789"));
    const minorBirthDate = success(
      BirthDate.create(LocalDate.fromISO("2010-04-15"), today)
    );
    const minorGovId = success(
      GovernmentIdInfo.create({
        type: "PASSPORT",
        number: "MIN-XYZ",
        country: "PL",
        expiryDate: today.plusDays(400),
      }, today)
    );
    const monthly = success(
      MonthlyDues.create(success(Money.fromMajor("10.00", "EUR")))
    );
    const enrollment = success(
      EnrollmentFee.create(success(Money.fromMajor("40.00", "EUR")))
    );
    const fees = success(FeeStructure.create(monthly, enrollment, []));

    const draft = success(
      ContractDraft.create({
        offer: { fees },
        userInfo: {
          personId: minorId,
          birthDate: minorBirthDate,
          governmentId: minorGovId,
        },
      })
    );

    const guardianId = success(PersonId.create("guardian-2"));
    const differentMinorId = success(PersonId.create("minor-other"));
    const wrongCoSignature = success(
      GuardianCoSignature.create({
        guardianId,
        minorId: differentMinorId,
        signedAt: today,
      })
    );

    const result = draft.toNotSignedContract(
      today,
      wrongCoSignature
    );
    failWith(result, "GUARDIAN_FOR_DIFFERENT_MINOR");
  });

  it("fails promotion when government ID is expired at promotion time", () => {
    const adultId = success(PersonId.create("adult-999"));
    const adultBirthDate = success(
      BirthDate.create(LocalDate.fromISO("1990-01-01"), today)
    );
    const idExpiringToday = success(
      GovernmentIdInfo.create({
        type: "ID_CARD",
        number: "EXP-001",
        country: "PL",
        expiryDate: today,
      }, today)
    );
    const monthly = success(
      MonthlyDues.create(success(Money.fromMajor("1.00", "EUR")))
    );
    const enrollment = success(
      EnrollmentFee.create(success(Money.fromMajor("1.00", "EUR")))
    );
    const fees = success(FeeStructure.create(monthly, enrollment, []));

    const draft = success(
      ContractDraft.create({
        offer: { fees },
        userInfo: {
          personId: adultId,
          birthDate: adultBirthDate,
          governmentId: idExpiringToday,
        },
      })
    );

    const result = draft.toNotSignedContract(today.plusDays(1));
    failWith(result, "ID_EXPIRED_AT_PROMOTION");
  });

  it("fails second promotion attempt (already ready to sign)", () => {
    const personId = success(PersonId.create("adult-111"));
    const birthDate = success(
      BirthDate.create(LocalDate.fromISO("1992-03-03"), today)
    );
    const governmentId = success(
      GovernmentIdInfo.create({
        type: "ID_CARD",
        number: "ID-READY",
        country: "PL",
        expiryDate: today.plusDays(10),
      }, today)
    );
    const monthly = success(
      MonthlyDues.create(success(Money.fromMajor("5.00", "EUR")))
    );
    const enrollment = success(
      EnrollmentFee.create(success(Money.fromMajor("0.00", "EUR")))
    );
    const fees = success(FeeStructure.create(monthly, enrollment, []));

    const draft = success(
      ContractDraft.create({
        offer: { fees },
        userInfo: { personId, birthDate, governmentId },
      })
    );

    expect(draft.toNotSignedContract(today)).toEqual({
      success: true,
      value: undefined,
    });
    const secondAttempt = draft.toNotSignedContract(today);
    failWith(secondAttempt, "INVALID_STATUS");
  });
});
