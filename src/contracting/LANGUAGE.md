# Contracting — Language

| Term | Meaning | Stages | Avoid |
|---|---|---|---|
| Contract Draft | Contract under preparation, before policies are met | draft | |
| Unsigned Contract | Prepared contract waiting for both signatures | unsigned | |
| Signed Contract | Contract signed by both parties, waiting for payment | signed | |
| Active Contract | Paid contract in force | active | |
| Potential Customer | Person the contract is prepared for, not yet bound | draft, unsigned | |
| Customer | Person bound by a signed contract | signed, active | |
| Sales Specialist | Company representative preparing and signing the contract | draft, unsigned | |
| Guardian | Adult co-signing for a minor | draft | |
| Guardian Co-Signature | Guardian's signature on a minor's contract | draft | |
| Government ID | Verified identity document of the Potential Customer | draft | |
| Fee Structure | Enrollment fee, monthly dues, penalties | draft | |
| Contract Prepared | Event: all draft policies met | draft | |
| Contract Signed | Event: both parties signed | unsigned | |
| Payment Confirmed | Event: payment succeeded | signed | |
| Payment Failed | Event: payment did not succeed | signed | |
| Contract Suspended | Event: active contract suspended | active | |

## Open

- `ContractActivated` (code) vs "Contract started" (board)
- Code uses `userId` / `userInfo` / `PersonId` where the board says Potential Customer
- `toNotSignedContract` vs stage name Unsigned Contract
- `recordPaymentAccepted` / `recordPaymentRejected` vs events Payment Confirmed / Payment Failed
- Contract Expired: mentioned, not defined
