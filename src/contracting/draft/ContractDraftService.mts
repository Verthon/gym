

import { err, okVoid, type Result } from '#/utils/Result.mts';
import type { ContractDraftRepository } from './ContractDraftRepository.mts';
import type { Clock } from '#/utils/Clock.mts';
import { LocalDate } from '#/utils/LocalDate.mts';
import type { ContractDraftError } from './ContractDraft.mts';

type PrepareInput = { draftId: string; guardianId?: string };

export const prepareUnsignedContract =
  (deps: { drafts: ContractDraftRepository; clock: Clock }) =>
  async (input: PrepareInput): Promise<Result<void, { code: 'NOT_FOUND' | ContractDraftError['code'] }>> => {
    const d = await deps.drafts.get(input.draftId);
    if (!d) return err({ code: 'NOT_FOUND' });

    const at = deps.clock.instant();
    const asOf = LocalDate.fromInstant(at, deps.clock.timeZone);
    const r = d.toNotSignedContract({ at, asOf } /*, guardian? */);
    if (!r.success) return err({ code: r.error.code });

    await deps.drafts.save(input.draftId, d);
    return okVoid();
  };