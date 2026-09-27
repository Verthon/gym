

import { err, okVoid, type Result } from '@/utils/Result.mjs';
import type { ContractDraftRepository } from './ContractDraftRepository.mjs';
import type { LocalDate } from '@/utils/LocalDate.mjs';
import type { ContractDraftError } from './ContractDraft.mjs';

type PrepareInput = { draftId: string; asOf: LocalDate; guardianId?: string };

export const prepareUnsignedContract =
  (deps: {
    drafts: ContractDraftRepository;
    bus: DomainEventPublisher;
  }) =>
  async (input: PrepareInput): Promise<Result<void, { code: 'NOT_FOUND' | ContractDraftError['code'] }>> => {
    const d = await deps.drafts.get(input.draftId);
    if (!d) return err({ code: 'NOT_FOUND' });

    const r = d.toNotSignedContract(input.asOf /*, guardian? */);
    if (!r.success) return err({ code: r.error.code });

    await deps.drafts.save(input.draftId, d);
    deps.bus.publishMany(d.pullEvents());
    return okVoid();
  };