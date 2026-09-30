# Offering — User stories

Source: *Understand Your Domain First*, Process Level board "Process of publishing an offer" and the final Context Map.

Offering: Supporting, Simple, Engagement. Upstream of Contracting as an open-host service; Contracting conforms to its model (see `functional-requirements.md`, FR-C02, FR-C03).

## Actors

- **Sales Specialist** — drafts, corrects and publishes offers.
- **Sales Coordinator** — evaluates completeness, approves or rejects.

## Flow

Draft → In review → Rejected ⇄ Corrected → Approved → Published

## Stories

### OF-1 Draft an offer

As a Sales Specialist, I want to draft a new membership offer, so that it can be reviewed and sold.

- Offer captures: name, membership durations (one or more of 1, 3, 6, 12 months), service package (facilities: gym floor, group classes, pool, sauna, …), fee structure (monthly dues, enrollment fee, penalties).
- Draft can be saved incomplete and edited freely.
- **Offer Prepared** is emitted when the Sales Specialist submits the draft for review.

### OF-2 Evaluate offer completeness

As a Sales Coordinator, I want to evaluate a submitted offer against the Offer completeness policy, so that only sellable offers reach customers.

- **Offer completeness policy**:
  - **Price calculation rule** — standard pricing calculation, at least one membership duration selected (1, 3, 6 or 12 months).
  - **Service package rule** — at least one facility specified.
- Only a Sales Coordinator can evaluate.

### OF-3 Reject an offer

As a Sales Coordinator, I want to reject an incomplete offer with the approval blockers noted, so that the Sales Specialist knows what to fix.

- Rejection requires at least one blocker.
- **Offer Rejected** is emitted with the blockers.

### OF-4 Correct a rejected offer

As a Sales Specialist, I want to address the feedback points and resubmit, so that the offer can be evaluated again.

- Only rejected offers can be corrected.
- **Offer Corrected** is emitted on resubmission; the offer returns to review (OF-2).
- No limit on reject/correct rounds.

### OF-5 Approve an offer

As a Sales Coordinator, I want to confirm offer readiness, so that it can be published.

- Allowed only when all completeness rules pass.
- **Offer Approved** is emitted.

### OF-6 Publish an offer

As a Sales Specialist, I want to distribute an approved offer to sales channels, so that customers can see it and contracts can be prepared from it.

- Only approved offers can be published.
- **Offer Published** is emitted; the offer appears in the Published Offers read model.

### OF-7 Provide offer details to Contracting

As Contracting, I want to get the details of a published offer, so that the Sales Specialist can prepare a contract from it.

- Query by offer ID returns: offer ID, available durations, service package, fee structure (monthly dues, enrollment fee, penalties).
- Contracting chooses one of the available durations per contract; Offering does not know which.
- Only published offers are returned.
- This is the published model Contracting conforms to — changes require coordinating with Contracting.

### OF-8 List available offers

As a Sales Specialist, I want to see which offers are currently available, so that I can present them to a customer.

- Returns published offers only.

## Out of scope

- Offer inquiries (handled by email/phone in v1).
- Promotion channels themselves (newsletter, in-app) — publishing only marks the offer available.
- "Which offer was the most popular in June?" — needs contract data from Contracting.

## Open questions

1. Can a published offer be edited or unpublished? The book treats Offer Published as pivotal (hard to reverse — customers may claim advertised terms).
2. Does an offer have a validity period (available from/until)?
3. Discounts: part of the offer (book mentions a 20% example), and can customers request them?
4. What is the "standard pricing calculation" — fixed monthly dues per duration, or derived?
5. Which sales channels exist, and does publishing differ per channel?
6. Is "Offer Reviewed" (board) a separate event, or only the outcome — Approved or Rejected?
7. Can the Sales Specialist who drafted an offer also be a Sales Coordinator approving it?
