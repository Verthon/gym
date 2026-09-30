# Unit tests below the seam

The acceptance tests already cover every AC. Your tests cover what they don't.

## Write

- Edge cases of Value Object validation the ACs don't hit (bounds, non-integers, `NaN`, `±Infinity`).
- Invariants of each entity transition, including the event payload shape from `pullEvents()` and that a second `pullEvents()` is empty.
- Port failures: a repository that rejects must make the service reject, not return `err`.
- Persistence: when a test claims something is saved, use a recording fake that captures `save` calls. An in-memory repository returning the same instance passes without `save`.

## Don't

- Restate an AC with different names. If the acceptance test already asserts it, delete your test.
- Ignore any `Result` in setup, including entity methods (`success(locker.assign(...))`). Unwrap it with `success(...)` from `#/utils/test.mts`; assert failures with `failWith(result, code)`.
- Add more values to a partition an AC already tests (more out-of-range integers).
- Name a test for something it doesn't assert. If the name claims "no duplicates", assert the count.
- Hand-roll helpers that `#/utils/test.mts` already has.

## Place

`__tests__/<Block>.spec.mts` inside the allowed folder. Never add tests to the acceptance test file.
