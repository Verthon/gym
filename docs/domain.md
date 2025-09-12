# Domain

## General

The gym management domain is centered around handling the essential business processes of a gym, structured to support end-to-end management for any fitness studio.

## Subdomains

1. Offering:
    Handles offer creation, review, and publication.

2. Contracting:
    Covers contract preparation, signing, and activation.

3. Pass Registration:
    Oversees pass issuance, cancellation, and expiration.

### Contracting

#### Contract Draft

Actors:

- Sales specialist
- Potential Customer

Policies (All must be met for valid contract):

- 18 years old + or guardian co-signature for minors
- contract must have verified government verified ID of the potential customer
- contract must have clear fees structure (penalities, monthly dues, enrollment fees)

Events:

- "Contract Prepared" event once all policies are met

#### Unsigned Contract

Actors:

- Sales specialist
- Potential Customer

Policies:

- contract is signed by our company representative
- potential customer has signed his side of the contract

Events:

- "Contract Signed" event once both parties signed their side of the contract

#### Signed Contract

Actors:

- Customer

Commands:

- Pay for the membership

External Services:

- Payment system

Events:

- Payment confirmed
- Payment failed

#### Active Contract

Policy:

- contract must be active
- no active pass rule, customer cannot have other active passes of the same type
