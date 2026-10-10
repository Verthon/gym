import { describe, it, expect } from "vitest";

import { Clock } from "../Clock.mts";

describe("Clock.system", () => {
	it("reads the current instant on every call in the given zone", () => {
		const clock = Clock.system("Europe/Warsaw");
		const before = Temporal.Now.instant();
		const read = clock.instant();
		const after = Temporal.Now.instant();
		expect(Temporal.Instant.compare(before, read)).toBeLessThanOrEqual(0);
		expect(Temporal.Instant.compare(read, after)).toBeLessThanOrEqual(0);
		expect(clock.timeZone).toBe("Europe/Warsaw");
	});
});

describe("Clock.fixed", () => {
	it("always returns the same instant in the given zone", () => {
		const instant = Temporal.Instant.from("2025-09-13T10:00:00Z");
		const clock = Clock.fixed(instant, "UTC");
		expect(clock.instant().equals(instant)).toBe(true);
		expect(clock.instant().equals(instant)).toBe(true);
		expect(clock.timeZone).toBe("UTC");
	});
});
