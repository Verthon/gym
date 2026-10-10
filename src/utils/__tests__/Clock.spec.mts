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

	it("normalizes the case of a region time zone", () => {
		expect(Clock.system("europe/lisbon").timeZone).toBe("Europe/Lisbon");
	});

	it.each(["+01:00", "CET", "UTC", "Etc/GMT-1", "Mars/Base", ""])(
		"rejects %j because it is not an IANA region time zone",
		(zone) => {
			expect(() => Clock.system(zone)).toThrow(RangeError);
		}
	);
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
