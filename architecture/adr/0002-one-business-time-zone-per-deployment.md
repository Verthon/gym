# 0002. Use one business time zone per deployment

- Date: 2026-10-10
- Status: Proposed

## 1. Circumstances

### Problem
"Today" depended on the time zone of the server.
From midnight until 01:00 (02:00 in summer) in Warsaw, a server running in UTC still has the previous day's date.
Date rules such as ID expiry, age 18 and "both signatures within 30 days" gave a different answer depending on where the code ran.

### Constraints
- Current architecture: the product is EU-only. The EU has three standard time zones (WET, CET, EET), and summer time still applies.
- Current architecture: there is no club concept yet.
- Current architecture: stored business dates have no zone attached. A date means "the calendar day in the business zone".

## 2. Intention

### Quality attributes
- Correctness of business-date rules: "today" is the calendar date at the gym, not at the server.
- Test determinism: a test result must not depend on the time zone of the machine.

### Measure
- `TZ=Pacific/Kiritimati pnpm test:unit` and `TZ=Pacific/Pago_Pago pnpm test:unit` give the same result as `pnpm test:unit`.
- An instant of `2025-09-12T22:30:00Z` is the business date `2025-09-13` in `Europe/Warsaw` and `2025-09-12` in `Europe/Lisbon`.

## 3. Decision

### Chosen
Each deployment has one business time zone, an IANA region zone such as `Europe/Warsaw`, set in the env var `GYM_TIME_ZONE`. Every business date is the calendar date in that zone. The process zone (`TZ`) plays no part.

Only IANA region zones are valid. Fixed offsets, `Etc/*` zones and abbreviations such as `CET` are rejected.

**Why:** A region zone gives the correct local date through summer time and through future rule changes. Keeping the zone out of the process zone means the server's own configuration cannot change a business date.

### Rejected alternatives
#### Server time zone
**Why rejected:** The business date changes with hosting. This works against correctness of business-date rules.

#### `TZ` env var as the business zone
**Why rejected:** `TZ` sets the process zone for legacy `Date`. It mixes the server's configuration with a business setting.

#### One fixed zone for the whole EU
**Why rejected:** The EU has three standard time zones. One zone gives the wrong date in some member states.

#### Fixed UTC offset (`+01:00`)
**Why rejected:** It ignores summer time, so the date is wrong for one hour around midnight for half the year.

#### A time zone per club now
**Why rejected:** There is no club concept yet.

## 4. Consequences

### Positive
- Correctness of business-date rules: a date is the same wherever the code runs.
- Test determinism: tests pass under UTC+14 and UTC−11 process zones.

### Trade-offs
- The deploy needs the `GYM_TIME_ZONE` env var.
- One deployment serves one zone. Clubs in different zones need separate deployments until a club concept exists.
- Moving to a zone per club later changes the meaning of stored dates. Dates saved before the move were "today" in the deployment's zone and must be migrated or kept with that zone.

## 5. Evidence
- Probe: on Node 26.11.1, `pnpm test:unit` gave 67/67 under `TZ=Pacific/Kiritimati` and `TZ=Pacific/Pago_Pago`.
- Probe: `Intl.supportedValuesOf("timeZone")` on Node 26.11.1 lists `Europe/Kiev` but not `Europe/Kyiv`, so it cannot validate zones.
- European Commission, *Summertime*: three standard time zones in the EU.
- Council of the EU, seasonal clock changes timeline: the 2018 proposal to end clock changes has no Council position.
- Jon Skeet, *Storing UTC is not a silver bullet*: keep the local value and the zone ID. UTC is derived.
- Node.js CLI docs, `TZ`: sets the process time zone.
