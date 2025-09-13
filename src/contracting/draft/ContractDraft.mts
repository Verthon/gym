import { UnsignedContract } from "../unsigned-contract/UnsignedContract.mjs";

import { LocalDate } from "@/utils/LocalDate.mjs";
import type { GovernmentIdInfo } from "./GovernmentIdInfo.mjs";
import type { BirthDate } from "./BirthDate.mjs";
import type { GuardianCoSignature } from "./GuardianCoSignature.mjs";
import type { PersonId } from "./PersonId.mjs";
import type { FeeStructure } from "@/money/FeeStructure.mjs";
import type { DomainEvent } from "@/events/event.mjs";
import { contractPrepared, toGenericEvent } from "./events.mjs";
import { okVoid } from "@/utils/Result.mjs";

type DraftStatus = "Draft" | "ReadyToSign";
export type ContractDraftProps = {
  offer: { fees: FeeStructure };
  userInfo: {
    personId: PersonId;
    birthDate: BirthDate;
    governmentId: GovernmentIdInfo;
  };
};

export type ContractDraftError =
  | { code: "INVALID_STATUS" }
  | { code: "MINOR_REQUIRES_GUARDIAN" }
  | { code: "GUARDIAN_FOR_DIFFERENT_MINOR" }
  | {
      code: "ID_EXPIRED_AT_PROMOTION";
      context: { expiry: LocalDate; asOf: LocalDate };
    };

/**
 * Represents the initial stage of a contract, where information is gathered and validated.
 */
export class ContractDraft {
  private _props: ContractDraftProps;
  private _status: DraftStatus;
  private _events: DomainEvent[] = [];

  private constructor(props: ContractDraftProps) {
    this._props = props;
    this._status = "Draft";
  }

  static create(
    props: ContractDraftProps
  ):
    | { success: true; value: ContractDraft }
    | { success: false; error: { code: string } } {
    return { success: true, value: new ContractDraft(props) };
  }

  public toNotSignedContract(
    asOf: LocalDate,
    guardian?: GuardianCoSignature
  ):
    | ReturnType<typeof okVoid>
    | { success: false; error: ContractDraftError } {
    if (this._status !== "Draft")
      return { success: false, error: { code: "INVALID_STATUS" } };

    const gov = this._props.userInfo.governmentId;
    const expiry = gov.getExpiryDate();
    if (expiry && expiry.isBefore(asOf)) {
      return {
        success: false,
        error: { code: "ID_EXPIRED_AT_PROMOTION", context: { expiry, asOf } },
      };
    }

    const isAdult = this._props.userInfo.birthDate.isAtLeast(18, asOf);
    if (!isAdult) {
      if (!guardian)
        return { success: false, error: { code: "MINOR_REQUIRES_GUARDIAN" } };
      if (!guardian.getMinorId().equals(this._props.userInfo.personId)) {
        return {
          success: false,
          error: { code: "GUARDIAN_FOR_DIFFERENT_MINOR" },
        };
      }
    }

    this._status = "ReadyToSign";
    this._events.push(
      toGenericEvent(
        contractPrepared({
          personId: this._props.userInfo.personId,
          fees: this._props.offer.fees,
        })
      )
    );

    return okVoid();
  }

  public status(): DraftStatus {
    return this._status;
  }
  public fees(): FeeStructure {
    return this._props.offer.fees;
  }
  public userId(): PersonId {
    return this._props.userInfo.personId;
  }

  public pullEvents(): DomainEvent[] {
    const out = this._events;
    this._events = [];
    return out;
  }
}
