# Requirements critic: Contracting

Skill: `/Users/verthon/.claude/skills/requirements-critic/SKILL.md`. It critiques requirement documents with 4 checks (1 problem vs solution, 2 observable behavior vs CRUD status, 3 signal map of hidden decisions, 4 rigid quantifiers). The task asked for one more step: check each examined requirement against the code. Code findings are labelled "Code".

Severity scale: **High** means the code produces wrong behavior or wrong events, or the requirement as written leads to wrong code. **Medium** means a decision that will otherwise be made silently in code, or a requirement that is not implemented. **Low** means wording, drift, or inconsistency.

## Assumptions

- No user was available. Check 2 asks for interactive reformulation with AskUserQuestion. Instead, this report gives the probe questions plus a draft rewrite that needs the user's acceptance.
- Target A requirements: `docs/domain.md` exists at 290ff38, so it was used instead of `architecture/functional-requirements.md`.
- `git show 290ff38:docs/domain.md` line numbers are cited as `domain.md@290ff38:N`.
- Out of scope for target B: `src/contracting/unsigned-contract/` and `active-contract/` in the working tree. FR-C07 to FR-C09 and FR-C16/17 are checked only where draft/ or signed-contract/ touch them.
- Signed-contract files have uncommitted modifications. They were read as they are in the working tree.
- I did not run any code. The double-emission behavior in target A comes from reading the state machine. The code path is deterministic.

---

## Target A: `src/contracting/unsigned-contract/` @ 290ff38 vs `docs/domain.md` @ 290ff38

Files: `UnsignedContract.mts`, `events.mts`, `__tests__/UnsignedContract.spec.mts`.

### Requirement: Unsigned Contract policies and event (`domain.md@290ff38:44-51`)

> "contract is signed by our company representative" / "potential customer has signed his side of the contract" / "Contract Signed event once both parties signed their side of the contract"

**Issues found:**

- **A1. Code: Contract Signed is emitted twice when the customer signs first.** High.
  - Where: `UnsignedContract.mts:39-51` and `:78-88`.
  - Scenario: `acceptTermsAndConditionsByCustomer` runs, giving AcceptedByCustomer. Then `confirmServiceCommitmentBySalesSpecialist` sets Signed and pushes ContractSigned (`:41`). Then `toSignedContract()` sees `Signed` and pushes ContractSigned again (`:78`). `pullEvents()` returns two identical events.
  - Consequence: downstream (Signed Contract / payment) would start twice.
  - The only success test (`spec:36-37`) signs sales first, so it misses this.
- **A2. Code: whether the event is emitted depends on signing order and on a separate call.** High.
  - Where: `UnsignedContract.mts:65-67`.
  - Scenario: Sales confirms, then the customer accepts. The state becomes Signed and **no event** is pushed. ContractSigned appears only if someone also calls `toSignedContract()`.
  - Result: in one order the event comes from the second signature, in the other only from the explicit promotion. The requirement says the event fires "once both parties signed". In the code, the event is tied to a method call, not to the signatures.
- **A3. Code: `toSignedContract()` is not idempotent.** High.
  - Where: `UnsignedContract.mts:73-91`.
  - Scenario: `toSignedContract()` is called twice. Examples are a retry after a timeout, or a handler that runs again. Each call pushes another ContractSigned. The state stays `Signed` and there is no "promoted" state, so the guard never closes.
  - Tests never call it twice.
- **A4. Check 2: "signed" is only a state label. Who signed is not recorded.** Medium.
  - Where: `domain.md@290ff38:46-47`, `UnsignedContract.mts:8-12`.
  - The policy talks about signatures. The code stores only `{kind, at}`. There is no signer identity: which Sales Specialist, and whether the signer is the contract's person. A `Signature` VO with `signerId` already exists (`draft/Signature.mts@290ff38`) and is not used.
  - Scenario: a dispute ("I never signed"). The system cannot show who confirmed for the company or who accepted.
  - Probe: "If the Signed status did not exist, how would anyone prove the contract was signed, and by whom?"
- **A5. Code: the first signature's date is lost.** Medium.
  - Where: `UnsignedContract.mts:40`, `:66`.
  - The `Signed` state overwrites `at` with the second signer's date. Scenario: sales signs on day 1 and the customer on day 25. Day 1 is gone.
  - This blocks any later signing-window rule (counted from preparation or from the first signature) and any audit.
- **A6. Check 3 (status transitions): reversibility, withdrawal and time limit are not specified.** Medium.
  - Where: `domain.md@290ff38:44-51`.
  - The requirement leaves these open:
    - Can the customer withdraw acceptance before sales confirms?
    - Can the contract stay unsigned forever?
    - Must the same Sales Specialist who prepared the draft confirm?
  - The code makes these irreversible and unbounded without saying so. The later FR-C09 (30-day window) shows the domain did need a time limit.
- **A7. Check 4: "potential customer has signed his side". Minors are not covered.** Medium.
  - Where: `domain.md@290ff38:47` vs `:29`.
  - Scenario: a 16-year-old was prepared with a guardian co-signature. At signing, only the minor accepts the terms. Is the minor's acceptance legally enough, or must the guardian accept too?
  - The code accepts the minor alone (`UnsignedContract.mts:58-71`) and does not know the person is a minor.
- **A8. Code: an Unsigned Contract can be created without a prepared draft.** Medium.
  - Where: `UnsignedContract.mts:28-30`.
  - Scenario: `UnsignedContract.create({personId, fees})` is public and needs no proof that "Contract Prepared" happened. The draft policies (`domain.md@290ff38:27`, "All must be met for valid contract") are bypassed if any caller skips the draft.
  - `ContractDraft.mts@290ff38:1` imports `UnsignedContract` but never uses it, so no handoff exists.
- **A9. Code: the ContractSigned payload cannot identify the contract.** Medium.
  - Where: `events.mts:9-12`.
  - The payload holds only `personId` and `fees`. Scenario: one person signs two contracts, for example a renewal or a second membership. The consumer cannot tell which contract was signed.
  - FR-C01 in the later document confirms this need.
- **A10. Code: inconsistent error shapes.** Low.
  - Where: `UnsignedContract.mts:34`, `:60` vs `:75`.
  - The signing methods return the bare string `"INVALID_STATE"`. `toSignedContract` returns `{code: "NOT_FULLY_SIGNED"}`. The `failWith` helper (`utils/test.mts@290ff38:19-27`) requires `{code}`, so the signing errors cannot be asserted with it.
  - The tests also never assert the results of the sign calls (`spec:36-37`, `:78`, `:93`).
- **A11. Check 1 / language drift: the code's names differ from the requirement's.** Low.
  - The requirement says "signed by our company representative" and "signed his side". The code says `confirmServiceCommitmentBySalesSpecialist` and `acceptTermsAndConditionsByCustomer`.
  - The later FR-C07 adopted the code's terms. At 290ff38 the two vocabularies differ and neither document maps one to the other.

**Questions to resolve before implementation:**
- Is Contract Signed raised by the second signature or by a separate promotion command? It cannot be both.
- Must each signature record the signer's identity? Must the company signer be the Sales Specialist who prepared the draft?
- Is there a signing deadline? Can a signature be withdrawn?
- For a minor, who accepts the terms: the minor, the guardian, or both?

**Suggested rewrite** (needs the user's acceptance):
```
Command:     Sales Specialist confirms service commitment; Customer (or Guardian for a minor) accepts terms. Either order.
Effect:      Each signature records signer identity and date. When the second signature is recorded,
             the contract can no longer be signed again and Contract Signed (contract ID, both signature dates) is emitted.
Idempotency: A repeated signature by the same party is rejected; Contract Signed is emitted exactly once regardless of order or retries.
Undo:        Irreversible once both have signed. [Withdrawal before the second signature: to decide.]
```

### Requirement: Contract Draft policies (`domain.md@290ff38:27-35`), only where they affect the Unsigned stage

- **A12. Check 4: "All must be met" is checked once, at preparation, and never re-checked at signing.** Low (for this target).
  - Scenario: the ID expires, or the guardian relationship changes, between preparation and signing. The Unsigned stage holds no data to re-check either.
  - This is a conscious decision only if someone writes it down. Neither 290ff38 document does.

### Summary (target A)
- One requirement block reviewed in full, plus one examined only for its effect on this stage.
- Issues: 12. High: 3 (A1-A3, all event emission). Medium: 6. Low: 3.
- Checks that fired:
  - Code check: 7 times.
  - Check 2: once (signature as a label).
  - Check 3: once.
  - Check 4: twice.
  - Check 1: once.
- Pattern: the requirement names a single event but never pins down when it fires. The code ties emission to a method call instead of the business moment, and gets the count wrong.

---

## Target B: `architecture/functional-requirements.md` (working tree) vs `src/contracting/draft/` and `src/contracting/signed-contract/`

### FR-C01: "Every event emitted by Contracting carries the contract ID."

- **B1. Code: no event carries the contract ID.** High.
  - Where:
    - `draft/events.mts:8-11`: ContractPrepared has `personId` and `fees`.
    - `draft/ContractDraft.mts:82`: the draft has `props.id` but does not pass it to the event.
    - `signed-contract/events.mts:8-11, 26-29, 44-49`: PaymentConfirmed, PaymentFailed and ContractStarted carry only `personId`.
    - `SignedContractProps` (`SignedContract.mts:12-16`) has no ID at all.
  - Scenario: a customer has two contracts in flight, for example a second membership. A PaymentConfirmed cannot be matched to its contract.
- **B2. Check 4: "Every event". Lapse has no definition yet.** Low.
  - Open question 6 (whether lapse is published) has to be answered before "every" can be tested. Already tracked, so noted only.

### FR-C02: "...creates a contract draft from a **published** offer..."

- **B3. Code: published status is not checked.** Medium.
  - Where: `draft/ReadModels.mts:3-12`, `ContractDraftService.mts:75-76`.
  - `OfferView` has no status field. `findOffer` returning anything non-null is enough. Scenario: the Sales Specialist drafts from an offer that was withdrawn or is still unpublished, and the draft succeeds.
  - Requirement side, Check 3: what happens to existing drafts, or to an Unsigned contract, when the offer is unpublished after preparation? FR-C03's snapshot covers price changes, not withdrawal.

### FR-C03: Offer snapshot with duration "(1, 3, 6 or 12 months)"

- **B4. Requirement contradiction: FR-C03 allows 1-month contracts but FR-C15 forbids termination before 3 months.** High.
  - Scenario: a 1-month contract ends at start + 1 month (FR-C14). It "cannot be terminated earlier than 3 months after the start date" (FR-C15). Either the minimum commitment does not apply to durations under 3 months, or 1-month durations are invalid.
  - D7 adopted both rules without reconciling them. Check 4 on "cannot".
- **B5. Code: the set of allowed durations is not enforced.** Low.
  - Where: `ContractDraftService.mts:79-81`.
  - Only membership in `offer.durationsInMonths` is checked. If Offering publishes 2 or 0 months, the draft accepts it.
  - `SignedContract.create` (`SignedContract.mts:37-39`) accepts any `durationInMonths`, including 0 or a negative value. That produces `endDate <= startDate` (`:54`).
  - Decide: is "1, 3, 6 or 12" a Contracting invariant or an Offering one?
- Snapshot content: implemented (`OfferSnapshot.mts:9-14`, `ContractDraftService.mts:118-123`). No other issue.

### FR-C04: "The draft is correctable: missing or invalid data can be supplied or fixed until the Contract validation policy passes."

- **B6. Code: not implemented. A failed draft is a dead end.** High.
  - Where: `ContractDraft.mts:41` (`readonly props`, no mutators). `ContractDraftService.mts` exports only create, prepare and status.
  - Scenario: `prepare` returns `ID_NOT_ATTESTED` or `MINOR_REQUIRES_GUARDIAN`. Nothing can attest the ID or add the guardian on that draft, so a new draft (a new contract ID) is the only path.
  - Also, `createContractDraft` rejects malformed input outright (`:89`, `:92`, `:100`). "Missing" data therefore never reaches a draft.
- **B7. Check 2: "correctable" has no stated observable effect.** Medium.
  - Questions the requirement leaves open:
    - Which fields can be corrected? Can the offer or duration change, or only customer data?
    - Can a correction be made after a failed preparation, and does it reset anything?
    - Is the correction history kept?
  - Probe: "If the Sales Specialist fixes the ID number, what does anyone else see differently?"

### FR-C05: Contract validation policy

- **B8. Code: an ID without an expiry date passes the Identification rule.** Medium.
  - Where: `ContractDraft.mts:66-67` (`expiry?.isBefore`), `GovernmentIdInfo.mts:9` (`expiryDate?` is optional), and the test "creates a valid ID without expiry" (`__tests__/GovernmentIdInfo.spec.mts:10`).
  - The requirement says the expiry date "is present". The service always parses one (`ContractDraftService.mts:88-89`), so the gap is reachable only through the domain API. The domain invariant itself is wrong, though.
- **B9. Check 2: "verification is attested by the Sales Specialist" is a boolean with no attester.** Medium.
  - Where: `ContractDraft.mts:22`, `ContractDraftService.mts:23`.
  - `governmentIdAttested: boolean` is supplied by the caller. Scenario: an audit asks who verified this customer's passport and when. The system holds `true` and nothing else.
  - This is the CRUD-status pattern: "attest" is a command whose only effect is a flag.
  - Probe: "If the flag did not exist, how would anyone know the ID was checked?"
- **B10. Check 4 / Code: no check that the Guardian is an adult.** Medium.
  - Where: Actors line 26 ("adult co-signing"), FR-C05 Age rule, `GuardianCoSignature.mts:25-49`, `ContractDraft.mts:71-76`.
  - Scenario: a 15-year-old's 16-year-old sibling is entered as guardian. The only checks are guardian ≠ minor and minorId = customer.
  - Requirement side: "a Guardian co-signature for this specific customer is present" says nothing about the guardian's age, identity verification or legal relationship.
- **B11. Code: the Guardian co-signature date is invented.** Medium.
  - Where: `ContractDraftService.mts:107-111`.
  - `signedAt: asOf` is the draft-creation date, not when the guardian actually signed. Scenario: the guardian signs on paper three days later. The record says they signed at creation.
- **B12. Check 3 (dates): no rule for a birthday on 29 February.** Low.
  - Where: FR-C05 "turning 18 that day passes". `BirthDate.mts:32-40`.
  - Scenario: born 2008-02-29, preparation on 2026-02-28. The code says 17 (the customer becomes 18 on 1 March). Jurisdictions differ.
  - The requirement should state the rule, or name the jurisdiction's rule.
- **B13. Check 3 (dates): the time zone of "the preparation date" is not stated.** Low.
  - Where: FR-C05, FR-C06, FR-C09.
  - The code uses `clock.timeZone` (`ContractDraftService.mts:86`, `:151`). `src/contracting/CONTEXT.md` says "gym time zone". The FR does not say.
  - Scenario: preparation at 23:30 local time on the day of an 18th birthday, on a UTC server. The result depends on which clock zone is wired in.
- **B14. Check 3 (money) / Code: a mixed-currency fee structure passes.** Medium.
  - Where: `OfferSnapshot.mts:3-7`, `ContractDraft.mts:35-38`, `ContractDraftService.mts:54-65`.
  - The Fee structure rule checks only for negative amounts. Scenario: monthly dues in EUR, enrollment fee in PLN. The draft prepares.
  - `money/FeeStructure.mts:33-46`, which the signed stage uses, rejects the same structure with `CURRENCY_MISMATCH`, so it would fail at the handoff. Is a single currency per contract a rule? The FR does not say.
- **B15. Check 4: "penalties are each itemized; no amount is negative". Zero amounts and empty penalties are undecided.** Low.
  - Scenarios:
    - A promotional enrollment fee of 0.00. The code allows it. Is that intended?
    - An offer with no penalties at all (`penalties: []`). The code passes it. Does "itemized penalties" require at least one?
- **B16. Check 4: the policy is evaluated "as of the preparation date" only.** Medium.
  - Scenario: the ID expires on day 10 of the 30-day signing window, and the customer signs on day 20 with an expired ID.
  - Should the Identification rule be re-checked at signature? A conscious "no" is fine. At present the gap is silent.
- **B17. Check 3 (personal data): retention of ID number and birth date is not stated.** Medium.
  - Where: `GovernmentIdInfo.mts:5-10`, `ContractDraft.mts:18-23`.
  - The draft stores the document number and birth date. Scenario: a lapsed contract (FR-C09) or an abandoned draft keeps a passport number forever.
  - Questions: retention period, erasure on request, who can read it. The FR is careful to say "no payment data" (FR-C10) but says nothing about identity data.

### FR-C06: "On passing validation, Contract Prepared is emitted (consumed by the frontend). The preparation date starts the signing window."

- **B18. Code: the event lacks the published-language payload.** High.
  - Where: `draft/events.mts:8-11` vs the Published language table, line 74.
  - The table requires "contract ID, customer, offer terms". The event carries personId and fees: no contract ID, offer ID, duration or service package.
- **B19. Code: the event is never published.** Medium.
  - Where: `ContractDraftService.mts:150-156`.
  - `prepareContract` saves the draft but never calls `pullEvents()` or a publisher, and no `process/` orchestrator exists (CONTEXT.md requires one). Scenario: preparation succeeds and the frontend receives nothing.
- **B20. Code: the preparation date is not stored.** Medium.
  - Where: `ContractDraft.mts:11`, `:80`.
  - The state becomes `{kind: "Unsigned"}` with no date. Only the event's `occurredAt` holds it, and the event is discarded (B19). The signing window (FR-C09) has no start.
- Check 1: "consumed by the frontend" names a consumer instead of the need. That is acceptable here because the table fixes it as a settled collaborator.

### FR-C07 to FR-C09: Signing (checked only for draft/signed handoff)

- **B21. Check 4: "the Customer accepts terms" for a minor.** Medium.
  - Where: FR-C07.
  - Same issue as A7: only Sales Specialist and Customer sign. Must the Guardian accept the terms at signing, or is the draft-time co-signature enough?
- **B22. Check 4: "within 30 days" has an open boundary.** Low.
  - Where: FR-C09.
  - Already tracked as open question 5, so noted only. Add the time zone (B13) to the same question.

### FR-C10: "Contracting issues the payment request; it stores only the payment reference, no payment data."

- **B23. Check 4 / Code: "the payment reference" (singular) conflicts with unlimited retries (FR-C12).** Medium.
  - Scenario: three attempts give three references. The code stores one reference, and only on success (`SignedContract.mts:24`). PaymentFailed records no reference (`events.mts:26-29`).
  - Which references are kept, and how is a late callback for attempt 1 matched?
- **B24. Code: Contracting issues no payment request.** Medium.
  - Where: `signed-contract/`.
  - The code only records outcomes. There is no "Pay for the membership" command and no amount (the Published language table, line 75, requires contract ID and amount). Open question 4 (the amount) blocks this.

### FR-C11: "Contracting records Payment Confirmed or Payment Failed as reported by the payment system."

- **B25. Check 2: "records" has no observable effect beyond the label.** Medium.
  - Where: `SignedContract.mts:62-98`.
  - Scenario: the payment system reports success for 10.00 when 109.00 was requested. The code accepts any `paymentRef` and checks no amount or currency.
  - Probes:
    - Does a confirmation for the wrong amount, or a partial one, count as Payment Confirmed?
    - What does the Customer see after Payment Failed?
- **B26. Check 3 (integration): ordering, duplicate callbacks and a missing callback are undefined.** Medium.
  - Scenarios:
    - The payment system sends Failed after Confirmed (out of order). The code returns `NOT_AWAITING_PAYMENT` and drops it (`SignedContract.mts:85-86`).
    - The same Confirmed arrives twice: the second returns an error instead of being accepted idempotently. A retry handler would treat it as a failure.
    - The payment system never answers: the contract waits forever (open question 2 covers unpaid lapse, not a missing response).

### FR-C12: "After Payment Failed the contract remains signed and awaiting payment. The Customer may retry payment any number of times."

- **B27. Code: Payment Failed is terminal.** High.
  - Where: `SignedContract.mts:85-87`, `:66-67`; test `__tests__/SignedContract.spec.mts:167-177` locks this in.
  - Scenario: card declined, then the customer retries with another card. `recordPaymentAccepted` returns `NOT_AWAITING_PAYMENT` and the customer can never become active. Listed in Implementation gaps, so it is a known gap, but the test asserts the opposite of the requirement.
- **B28. Check 4: "any number of times" also allows concurrent attempts, which can charge twice.** Medium.
  - Scenario: the customer starts two payments in two tabs and both succeed. The code accepts the first and rejects the second (`NOT_AWAITING_PAYMENT`), but the money for the second was taken.
  - The requirement needs one of these: only one attempt in flight at a time, or a refund/compensation rule for duplicate confirmations.

### FR-C13: "the contract starts when payment is confirmed. Contract Started is emitted exactly once."

- **B29. Code: start is a separate command with a caller-chosen date, not a consequence of payment.** Medium.
  - Where: `SignedContract.mts:41-60`.
  - Scenario: payment is confirmed and nobody calls `toActiveContract`, so the contract never starts. Or it is called with `startDate` a month after payment.
  - "Exactly once" holds (`:45-47`, test `spec:179-187`). Open question 3 covers the start date. Listed in gaps as "Start policy implicit".
- **B30. Code: the Contract Started payload is incomplete for Pass Registration.** High.
  - Where: `signed-contract/events.mts:44-49` vs the Published language table, line 76.
  - The table requires contract ID, customer, start date, end date and service package. The event has no contract ID and no service package (it has fees instead).
  - Pass Registration's policy ("no other active pass of the same type", line 85) cannot be evaluated without the service package. See also open question 7.

### FR-C14: "The contract end date is the start date plus the membership duration."

- **B31. Check 3 (dates): end-of-month and inclusivity are undefined.** Medium.
  - Where: `LocalDate.mts:28-30` (Temporal `add`, which clamps).
  - Scenario: start 2026-01-31 + 1 month = 2026-02-28. Start 2026-03-31 + 1 month = 2026-04-30.
  - Scenario: start 2025-09-13 + 12 months = 2026-09-13 (test `spec:57`). Is 2026-09-13 the last valid day, or the first day after? Pass Registration's "contract end date" policy depends on it.
  - Duration is not passed from the draft (gap list, FR-C14), so `durationInMonths` is unchecked caller input (B5).

### FR-C15: Minimum commitment

- See B4 (contradiction with 1-month durations). Not implemented in code, which is listed in the gaps.

### FR-C16: Status query (Draft, Unsigned, Lapsed, Signed awaiting payment, Active)

- **B32. Code: only the draft's status is queryable.** Low.
  - Where: `ContractDraftService.mts:159-165`.
  - Only `"Draft" | "Unsigned"` are returned. `SignedContract` has no status accessor, and its internal states (`PaymentAccepted`, `PaymentRejected`) are not in the FR's list.
  - Scenario: after payment is accepted but before start, which FR-C16 status applies? `PaymentAccepted` maps to nothing. Expected, since there is no orchestrator.

### FR-C17: Number of contracts signed in a period

- Not in target B's code (it is an Unsigned-stage fact). Check 3: "a given period (e.g. last month)" needs a time zone and a rule for which date counts (second signature per FR-C08). Low. Not raised as a separate finding.

### "Implementation gaps" section (lines 124-135)

- **B33. The gaps list is stale and understates progress in 3 entries.** Low.
  - The three stale entries:
    - "No contract ID": `ContractId` exists and the draft has one (`ContractDraft.mts:16`, `ContractDraftRepository.mts:13-17`). The real gap is that events don't carry it (B1).
    - "Two `FeeStructure` classes; the draft uses the one without penalties": the draft uses `OfferFees` with penalties (`OfferSnapshot.mts:6`). The real gap is that the two fee types differ in currency validation (B14).
    - "Draft carries only fees from the offer" and "ID verification attestation not modeled": both are now modeled (`OfferSnapshot.mts:9-14`, `ContractDraft.mts:22`, `:64`).
  - Missing from the list: B6 (FR-C04 not implemented), B19 (events never published) and B30 (Contract Started payload).

### Verification metric (line 93)

- **B34. Check 4: "failure rate below 0.1%" has no definition of failure or window.** Low.
  - Scenarios: is a declined card a failure? Is a timeout? Is the rate measured per day, per month, or over all time?
  - As written, a declined card might count as an integration failure, and then the metric measures customers' cards rather than the integration.

### Summary (target B)
- Requirements reviewed: 17 FRs, plus the published-language table, the gaps list and the verification metric.
- Requirements with issues: 15. No issues: none fully clean. FR-C03's snapshot content and FR-C13's "exactly once" are implemented correctly.
- Issues: 34. High: 6 (B1, B4, B6, B18, B27, B30). Medium: 19. Low: 9.
- Checks that fired:
  - Code check: 18 times.
  - Check 3: 9 times.
  - Check 4: 8 times.
  - Check 2: 3 times (B7, B9, B25).
  - Check 1: once (acceptable).
- Pattern: event payloads and identity are the weakest area. No event matches the published-language table. The requirement text is strong on validation rules but leaves dates (time zone, month ends, inclusivity), money (currency, amount check) and integration ordering to the code.
