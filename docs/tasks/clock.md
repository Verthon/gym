# Clock

Created: 2026-10-10
Status: open, resume with decision 1

## Goal

Make `Clock` (`src/utils/Clock.mts`) the reusable building block for time in this boilerplate. Domain code never reads time. Application services read it once per use case. Tests set it without patching globals. Input: [ADR 0002](../../architecture/adr/0002-node-26-temporal-and-injected-clock.md).

## Current state (2026-10-10)

- `Clock = { instant(): Temporal.Instant; timeZone }`.
  - `Clock.system(zone?)` reads the system time.
  - `Clock.fixed(at, zone?)` takes an `Instant` or an ISO string.
- The zone defaults to `GYM_TIME_ZONE`, read when the clock is created. Only an IANA region zone passes: offsets, `Etc/*`, `UTC` and `CET` throw `RangeError`. A missing env var throws.
- `vitest.config.mts` sets `GYM_TIME_ZONE=Europe/Warsaw`. A test changes it with `vi.stubEnv` or by giving the zone explicitly.
- `LocalDate` wraps `Temporal.PlainDate`. The only way to get "today" is `LocalDate.today(clock)`.
- Domain code takes `asOf` / `at`. Event factories require `occurredAt`.
- Only `ContractDraftService` reads a clock, from `deps.clock`. Nothing creates a `Clock.system()` yet.
- Stryker: `Clock.mts` 95.65%. The only survivor is the `RangeError` message string (bucket 3 in `mutation-testing.md`).

## Decisions

1. **`occurredAt` type.** Events carry `LocalDate`, so two events on the same day have no order, and the audit trail has no time of day.
   - Keep `LocalDate`.
   - `Temporal.Instant`. The service reads `clock.instant()` once and derives `asOf` from it, so the date and the instant always agree.
   - Both.
   - Check `docs/architecture/events.md` first: integration events allow primitives only.
2. **Who wires the clock.** Create `Clock.system()` in the composition root once at startup, so a bad `GYM_TIME_ZONE` fails before the server listens. Or create it per request, which allows a per-club zone later. The first wired use case forces this choice.
3. **Moving time in tests.** Rules such as FR-C09 ("both signatures within 30 days of the preparation date") need a test where time moves forward.
   - `Clock.offset(clock, duration)`, as in Java.
   - A mutable test clock with `advance(duration)`.
   - Only new `Clock.fixed` values per step.
   - Decide when the first such spec arrives.
4. **Per-club zone.** When a club concept arrives:
   - The zone moves from `GYM_TIME_ZONE` to the club.
   - A `withZone(clock, zone)` helper (Java `Clock.withZone`) gives the use case a clock for that club.
   - `GYM_TIME_ZONE` stays as the default, or goes away.

## Tasks

### 1. Wire the clock

- [ ] Resolve decision 2
- [ ] Call `Clock.system()` in the composition root, and pass `clock` into the service deps
- [ ] Startup fails with a clear message when `GYM_TIME_ZONE` is missing or invalid. Write a test for this
- [ ] Document `GYM_TIME_ZONE` for deploy: README, or `.env.example` if the project gets env files

### 2. Defend the rule with code

ADR 0002 measure: outside `Clock.mts`, nothing reads `Temporal.Now`, `new Date()` or `GYM_TIME_ZONE`. Today only a grep checks this.

- [ ] An oxlint rule (`no-restricted-globals` / `no-restricted-syntax` / `no-restricted-properties`, check what oxlint supports), or a check in `architecture-check.md`
- [ ] Allow `Temporal.Now` only in `src/utils/Clock.mts`. Allow `Temporal.Now` in specs, or not at all?
- [ ] The building-block CLI (`building-block-cli.md`): the `service` template puts `clock: Clock` in deps, and the `entity` template takes `at: LocalDate` in behaviours

### 3. `occurredAt`

- [ ] Resolve decision 1
- [ ] Update `docs/architecture/events.md` and the event factories

### 4. `LocalDate` API

- [ ] Add methods only when a spec needs them. FR-C09 needs "days between" with an inclusive day 30 (`docs/skill-runs/requirements-critic/report.md:93`)
- [ ] `BirthDate.ageAsOf` counts years by hand. `PlainDate.until(…, { largestUnit: "years" })` would be shorter, but gives a different result for 29 February birthdays (`2000-02-29` → `2001-02-28` counts as 1 year). Write the rule for 29 February in the spec before changing it

### 5. Tests that move time

- [ ] Resolve decision 3 with the first spec that needs it

### 6. Per-club zone

- [ ] Resolve decision 4 when the club concept arrives

### 7. Clean-up

- [ ] Node 24 references: `resume-architecture-drivers.md`, `building-block-cli.md` ("run directly by Node 24")
- [ ] Temporal keeps aliases such as `Europe/Kiev` as given. Decide whether `Clock` should map aliases to the primary name. `Intl.supportedValuesOf` on Node 26.11.1 lists `Europe/Kiev`, not `Europe/Kyiv`, so it can't serve as the source
