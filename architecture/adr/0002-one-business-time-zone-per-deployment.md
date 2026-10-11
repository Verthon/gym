# 0002. Use Node 26 Temporal for business dates, with an injected Clock and one gym time zone

- Date: 2026-10-10
- Status: Proposed
- Supersedes: the Node 24 floor in [0001](0001-run-typescript-source-on-node-24.md). The no-build decision of 0001 stays.

## 1. Circumstances

### Problem
`LocalDate` wrapped a JS `Date` that kept the time of day.
`isBefore` compared milliseconds, but `equals` compared calendar days.
The test "accepts expiry equal to today" failed when the clock moved between two `LocalDate.today()` calls.
One mutant changed from survived to killed with no code change.
VOs and event factories called `LocalDate.today()` directly.
`ContractPrepared.occurredAt` used the wall clock, not the `asOf` date of the use case.
"Today" also depended on the time zone of the server.

### Constraints
- Current architecture: the backend runs on Node 24.21.0. Node 24 has `Temporal` only behind `--harmony-temporal`, with an older implementation.
- Current architecture: Node 26 enables `Temporal` by default. Node 26 becomes LTS on 2026-10-28.
- Current architecture: TS 7 knows `Temporal` only with `lib` `esnext.temporal`.
- Current architecture: the product is EU-only. The EU has three standard time zones (WET, CET, EET), and summer time still applies.
- Current architecture: there is no club concept yet, and `src/index.ts` has no use-case wiring.

## 2. Intention

### Quality attributes
- Test determinism: a test result must not depend on when or where the test runs.
- Correctness of business-date rules: "today" is the calendar date at the gym, not at the server.

### Measure
- Five repeated `pnpm test:unit` runs give the same result.
- Two `pnpm mutation --force` runs give the same killed and survived counts.
- Outside `src/utils/Clock.mts`, no file in `src/` reads `Temporal.Now`, `new Date()` or `GYM_TIME_ZONE`. Only application services call `LocalDate.today(clock)`.

## 3. Decision

### Chosen
Move to Node 26 and use native `Temporal` for business dates.

- `.nvmrc` and `devEngines.runtime` pin Node 26.11.1. `engines.node` is `>=26.0.0`.
- `tsconfig.json` adds `esnext.temporal` to `lib`.
- `LocalDate` wraps `Temporal.PlainDate`. It has no time of day.
- `Clock` gives `instant(): Temporal.Instant` and a `timeZone`. `Clock.system()` reads the system time. `Clock.fixed(at)` is for tests.
- Only application services read the clock: `LocalDate.today(deps.clock)`. Domain code receives the date as `asOf` or `at`.
- Event factories require `occurredAt`. They do not read the clock.
- The business time zone is one IANA region zone per deployment, from the env var `GYM_TIME_ZONE` (for example `Europe/Warsaw`).
- `Clock` reads `GYM_TIME_ZONE` when the caller gives no zone. No other code reads it.
- A test can give an explicit zone, or change `GYM_TIME_ZONE` with `vi.stubEnv`. `vitest.config.mts` sets it to `Europe/Warsaw`.
- `Clock` rejects offsets, `Etc/*` zones and abbreviations such as `CET`.
- `date-fns` is removed.

**Why:** `PlainDate` makes every comparison a date comparison, so equal dates cannot compare as before or after. An injected clock makes "today" an input, so tests set it and do not race it. A region zone keeps the correct local date through summer time and through future rule changes. The domain stays free of time zones and of the system clock.

### Rejected alternatives
#### Keep `date-fns` and truncate to midnight
**Why rejected:** It fixes the race, but "today" still depends on the server time zone. This works against correctness of business-date rules.

#### `date-fns` with `@date-fns/tz`
**Why rejected:** It adds a dependency, and the values are still `Date` instants with a time of day.

#### Temporal polyfill on Node 24
**Why rejected:** It adds a dependency that Node 26 makes unnecessary. Polyfill global types conflict with `lib.esnext.temporal`.

#### Patch global time in tests (Vitest fake timers, Deno `FakeTime`)
**Why rejected:** It is a test-harness tool, not a domain building block. Domain code still reads the clock directly.

#### `TZ` env var as the business zone
**Why rejected:** `TZ` sets the process zone for legacy `Date`. `Clock` never reads the process zone.

#### One fixed zone for the whole EU
**Why rejected:** The EU has three standard time zones. One zone gives the wrong date in some member states.

#### A time zone per club now
**Why rejected:** There is no club concept yet. A clock with a different zone can add this later without domain changes.

## 4. Consequences

### Positive
- Test determinism: specs use a fixed date, and tests do not depend on the machine time zone. Five repeated runs gave 53/53 each time.
- Correctness of business-date rules: `ContractPrepared.occurredAt` now equals the `asOf` of the use case.

### Trade-offs
- Behaviours and VO factories take one more parameter (`asOf` or `at`).
- The deploy needs Node 26 and the `GYM_TIME_ZONE` env var.
- Node 26 is "Current", not LTS, until 2026-10-28.
- No composition root calls `Clock.system()` yet. A missing `GYM_TIME_ZONE` fails only when the first use case is wired.

## 5. Evidence
- Probe: oxlint, tsc 7.0.2, vitest 3.2.4, knip 6.38, Stryker 10, tsx and hono ran on Node 26.11.1.
- Probe: pnpm 12.6 `devEngines` with `onFail: download` installed Node 26.11.1.
- Probe: TS 7 accepts `Temporal` with `lib` `esnext.temporal` and rejects it with `es2025` only.
- Probe: `typeof Temporal` is `undefined` on Node 24.21.0 and `object` on Node 26.11.1.
- Probe: `Intl.supportedValuesOf("timeZone")` on Node 26.11.1 lists `Europe/Kiev` but not `Europe/Kyiv`, so `Clock.system` does not use it for validation.
- Node.js v26.0.0 release notes: "The Temporal API is now enabled by default in Node.js 26."
- nodejs/Release schedule: Node 26 Active LTS from 2026-10-28. Node 24 maintenance from 2026-10-20.
- Oracle, `java.time.Clock`: pass a `Clock` into any method that needs the current instant and time zone.
- MDN, `Temporal.Now.plainDateISO`: the current date in a given time zone.
- TypeScript 6.0 release notes: `Temporal` types through `esnext.temporal`.
- European Commission, *Summertime*: three standard time zones in the EU.
- Council of the EU, seasonal clock changes timeline: the 2018 proposal to end clock changes has no Council position.
- Jon Skeet, *Storing UTC is not a silver bullet*: keep the local value and the zone ID. UTC is derived.
- Node.js CLI docs, `TZ`: sets the process time zone.
