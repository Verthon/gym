# Requirements Critic — Contracting FRs and Offering stories

Input: `architecture/functional-requirements.md` (FR-C01…C17, published language) and `architecture/offering-user-stories.md` (OF-1…OF-8).
Mode: non-interactive. The questions that would normally go to the user through AskUserQuestion are listed under each requirement, unanswered. Where the doc's own Open questions already cover a point, it is referenced instead of repeated.

## Headline findings

1. **FR-C03 × FR-C15 contradiction.** Offers allow 1-month durations, but the minimum commitment is 3 months from start. A 1-month contract ends before the commitment does.
2. **The Offer completeness policy (OF-2) doesn't check fees**, yet Contracting's Fee structure rule (FR-C05) rejects drafts with bad fees. A published offer can produce drafts that can never pass validation.
3. **"Snapshot at preparation time" (FR-C03) is ambiguous.** It's unclear whether it means draft creation or Contract Prepared. The draft is correctable in between, so the offer can change under it.
4. **FR-C12 "retry any number of times"** allows a retry while an earlier payment is still pending, which risks a double charge.
5. **FR-C15 "cannot be terminated earlier than 3 months"** has no exceptions. Consumer-law withdrawal rights (distance contracts), medical cases and gym closure are all candidates.

---

### FR-C01 "Every contract has a unique contract ID assigned at draft creation."

No issues found — requirement is well-formed.

### FR-C02 "The Sales Specialist creates a contract draft from a published offer … and customer information"

**Issues found:**
- Check 3 (🔒 Personal data): the customer information includes the government ID number, birth date and, for minors, the guardian's identity. Nothing covers retention or access.

**Questions to resolve before implementation:**
- How long are government ID numbers kept after a draft lapses or a contract ends? Is it the full number or a masked one?
- Who can read a draft's personal data — only its Sales Specialist, or any?
- If the offer is unpublished while a draft is open, does the draft stay valid? (Offering open question 1.)

### FR-C03 "The draft captures a snapshot of the offer terms at preparation time … Later changes to the offer do not affect the contract."

**Issues found:**
- Check 3 (📅 Dates / 💰 Price — "when does the price freeze?"): "preparation time" can mean draft creation (FR-C02) or the moment Contract Prepared is emitted (FR-C06). The draft is correctable in between (FR-C04), so the offer can change in between too.
- Check 4: "one of 1, 3, 6 or 12 months" combined with FR-C15 (3-month minimum commitment) — see FR-C15.

**Questions to resolve before implementation:**
- Is the snapshot taken when the draft is created, and never refreshed? Or is it refreshed on every correction until Contract Prepared?
- If the offer changes while the draft is open, does the Sales Specialist see the change?

**Suggested rewrite:**
> The draft copies the offer terms when it is created: offer ID, service package and fee structure, plus the membership duration the Sales Specialist picks from the offer's durations. Later changes to the offer never change an existing draft or contract.

### FR-C04 "The draft is correctable …"

**Issues found:**
- Check 3 (👥 Shared data): it doesn't say who can correct. Only the Sales Specialist who created the draft, or any?

**Questions to resolve before implementation:**
- Can a different Sales Specialist take over a draft (shift change, sick day)?

### FR-C05 Contract validation policy

**Issues found:**
- Check 4 "at least 18 on the preparation date, or a Guardian co-signature": what about a minor who turns 18 between preparation and signing, or during the contract? And is the guardian's own age or ID checked at all?
- Check 4 "monthly dues, enrollment fee and penalties are each itemized": can the penalty list be empty? The code allows `penaltyFees: []`. "Each itemized" reads as "at least one of each".
- Check 4 "no amount is negative": the code is stricter than the requirement. Monthly dues must be > 0 and each penalty must be > 0. There are also caps: enrollment ≤ 500, dues ≤ 1000, penalty ≤ 200, all in the contract currency. Penalty reasons are a closed list. None of this is in the requirement.

**Questions to resolve before implementation:**
- Must the guardian be verified (ID attested, ≥ 18)?
- Is an offer with no penalties valid?
- Are the amount caps business rules? If yes, whose — the gym's, or the platform's for all gyms? They belong in the requirement or should be removed from code.

### FR-C06 "On passing validation, Contract Prepared is emitted (consumed by the frontend)."

**Issues found:**
- Check 1: "consumed by the frontend" names a consumer, not a need. What is the Sales Specialist supposed to do with it — hand the contract to the Customer for signing, or print it?

**Questions to resolve before implementation:**
- Is there any consumer besides the UI that triggered the preparation? If not, a command result is enough and this doesn't need to be published language.

### FR-C07 "The Sales Specialist confirms service commitment; the Customer accepts terms and conditions. Either may happen first; each happens at most once."

**Issues found:**
- Check 3 (🔄 State transitions): the requirement doesn't say whether a signature can be withdrawn before the other party signs.
- Check 4 "at most once": what if the Customer accepts, then the Sales Specialist finds an error in the terms? The only way out stated is lapse after 30 days.

**Questions to resolve before implementation:**
- Can the Customer or the Sales Specialist cancel an Unsigned Contract explicitly, instead of waiting 30 days for it to lapse?
- How is the Customer's acceptance captured — in person on the specialist's device, or remotely? This decides whether the two signatures can race (see problem-classifier).

### FR-C08 "Contract Signed is emitted exactly once, dated at the second signature."

No issues found — requirement is well-formed.

### FR-C09 "both signatures must be given within 30 days of the preparation date. After that the contract lapses"

**Issues found:**
- Check 2: "lapses" is a status, but the requirement doesn't say what triggers it. FR-C16 must report "Lapsed", so either a clock moves it or it's computed when read.
- Check 3 (📅 Dates): time zone of "30 days" (gym's? server's?) and inclusivity (open question 5).

**Suggested rewrite:**
> Command: the Sales Specialist or the Customer signs.
> Effect: rejected with "signing window closed" if the date is more than 30 days after the preparation date (inclusive of day 30, gym's time zone).
> Status query (FR-C16) reports Lapsed for any Unsigned Contract past its window, whether or not anyone tried to sign.

### FR-C10 "Contracting issues the payment request; it stores only the payment reference"

**Issues found:**
- Check 3 (💰 Price): amount (open question 4), currency and rounding are all unstated.
- Check 3 (🔌 Integration): no named scenario for "payment system doesn't answer".

**Questions to resolve before implementation:**
- If the payment system never reports an outcome, how long does the contract wait, and who notices?

### FR-C11 "Contracting records Payment Confirmed or Payment Failed as reported"

**Issues found:**
- Check 3 (🔌 Integration): duplicate and out-of-order reports aren't covered.

**Questions to resolve before implementation:**
- Payment Failed arrives after Payment Confirmed for the same contract (a late callback from an earlier attempt). Which wins?
- The same Confirmed arrives twice — ignore silently?

### FR-C12 "After Payment Failed … The Customer may retry payment any number of times."

**Issues found:**
- Check 4 "any number of times": a retry while the previous attempt is still unresolved can lead to two confirmations and a double charge. Unlimited retries are also a card-testing vector.

**Questions to resolve before implementation:**
- Can a new payment request be issued while one is pending?
- If two payments are confirmed, is the second refunded automatically, and by whom?

**Suggested rewrite:**
> After Payment Failed the contract stays signed and awaiting payment. The Customer can request a new payment only when no payment request for this contract is pending. A second confirmation for an already started contract is recorded and flagged for refund.

### FR-C13 "the contract starts when payment is confirmed. Contract Started is emitted exactly once."

No new issues; open question 3 already covers start date vs chosen date.

### FR-C14 "The contract end date is the start date plus the membership duration."

**Issues found:**
- Check 3 (📅 Dates): month arithmetic isn't defined. Jan 31 + 1 month = Feb 28 or Mar 3? Is the end date inclusive (last day of access) or exclusive?

**Suggested rewrite:**
> End date = start date + N calendar months, clamped to the last day of the month. The end date is the last day the membership is valid.

### FR-C15 "the contract cannot be terminated earlier than 3 months after the start date"

**Issues found:**
- Check 4 "cannot": boundary scenarios —
  - A 1-month contract (FR-C03 allows it) ends before the minimum commitment does.
  - A contract signed remotely may fall under the consumer withdrawal right for distance contracts (14 days in the EU). The rule would block a legally required cancellation.
  - The gym closes a facility in the service package, or the customer has a medical condition. (Open question 8 covers suspension, not termination.)

**Questions to resolve before implementation:**
- Is the 1-month duration allowed at all, given the minimum commitment? If yes, does the commitment become min(3 months, duration)?
- Are any contracts concluded at a distance?

**Suggested rewrite:**
> Minimum commitment: the Customer cannot terminate before the earlier of (start + 3 months) and the end date, except under legally mandated withdrawal and [list of business exceptions].

### FR-C16 Contract status query

**Issues found:**
- Check 3 (🔄 State transitions): the list has no state for after the end date. FR-C14 creates an end date, but nothing reports the contract past it. Expiration is out of scope, but the query will be asked anyway.

### FR-C17 "Number of contracts signed in a given period"

**Issues found:**
- Check 3 (📅 Dates): the period boundary depends on the time zone, and "signed" is dated at the second signature (FR-C08). State that, so reports match.

### Published language — Contract Started → Pass Registration

No new issues; open question 7 (pass "type") already covers the blocker.

---

### OF-1 Draft an offer

**Issues found:**
- Check 4 "edited freely": is editing allowed In review, Approved or Published? OF-4 says only rejected offers can be corrected, which suggests not — but OF-1 doesn't say so.
- Check 3 (💰 Price): the currency per offer isn't stated. Contracting requires one currency per fee structure.

**Suggested rewrite:**
> A Sales Specialist can edit an offer only while it is a Draft or Rejected. Submitting it for review freezes the content; any later change needs a new offer, or a new version once open question 1 is decided.

### OF-2 Evaluate offer completeness

**Issues found:**
- Check 4 / cross-context: the completeness policy checks durations and facilities only. It doesn't check the fee structure: all three fees present, same currency, non-negative. FR-C05 rejects drafts that fail those rules, so a published offer can be unsellable.
- "Standard pricing calculation" is undefined (open question 4) and can't be verified as written.

**Suggested rewrite:**
> Offer completeness policy: (1) at least one membership duration from {1, 3, 6, 12}; (2) at least one facility; (3) fee structure has monthly dues, enrollment fee and penalties itemized, in one currency, none negative — the same rule Contracting applies (FR-C05).

### OF-3 Reject an offer

No issues found — requirement is well-formed.

### OF-4 Correct a rejected offer

No issues found — requirement is well-formed.

### OF-5 Approve an offer

**Issues found:**
- Check 4 "Allowed only when all completeness rules pass": if approval is purely mechanical, the Sales Coordinator adds nothing. If the Coordinator also judges commercially, can they reject a complete offer? OF-3 says "reject an incomplete offer".

**Questions to resolve before implementation:**
- Can a complete offer be rejected for commercial reasons? If yes, OF-3's "incomplete" is too narrow.

### OF-6 Publish an offer

No new issues; open questions 1 and 5 already cover unpublish/edit and channels.

### OF-7 Provide offer details to Contracting

No issues found — requirement is well-formed. It depends on the FR-C03 snapshot timing being settled.

### OF-8 List available offers

No issues found — requirement is well-formed.

---

## Summary

- Reviewed: 17 FRs + 1 published-language table + 8 stories = 26 items.
- With issues: 16 (FR-C02–C07, C09–C12, C14–C17, OF-1, OF-2, OF-5).
- Checks that fired most: Check 3 (hidden decisions — mostly 📅 dates and 🔌 integration), then Check 4 (quantifiers: "any number", "cannot", "freely", "at most once").
- Check 2 (status disguised as behavior) fired only on "lapses" (FR-C09). The requirements are mostly written as observable effects already.
- Recurring pattern: rules live in one context and are missing from the other. Fees are validated in Contracting but not in Offering, and minimum commitment vs 1-month durations conflict.
- Code vs requirement: `src/money` enforces caps, positivity and penalty reasons that the FRs don't mention. `src/contracting/draft/FeeStructure.mts` is not imported anywhere. The implementation-gaps list says the draft uses the class without penalties, but it actually uses `@/money/FeeStructure`.
