import { afterEach, describe, it, expect, vi } from "vitest";

import { Clock } from "../Clock.mts";

afterEach(() => {
	vi.unstubAllEnvs();
});

describe("Clock.system", () => {
	it("reads the current instant on every call", () => {
		const clock = Clock.system();
		const before = Temporal.Now.instant();
		const read = clock.instant();
		const after = Temporal.Now.instant();
		expect(Temporal.Instant.compare(before, read)).toBeLessThanOrEqual(0);
		expect(Temporal.Instant.compare(read, after)).toBeLessThanOrEqual(0);
	});

	it("uses GYM_TIME_ZONE by default", () => {
		expect(Clock.system().timeZone).toBe("Europe/Warsaw");
		vi.stubEnv("GYM_TIME_ZONE", "Europe/Lisbon");
		expect(Clock.system().timeZone).toBe("Europe/Lisbon");
	});

	it("uses an explicit time zone over GYM_TIME_ZONE", () => {
		expect(Clock.system("Europe/Helsinki").timeZone).toBe("Europe/Helsinki");
	});

	it("fails when GYM_TIME_ZONE is not set and no zone is given", () => {
		vi.stubEnv("GYM_TIME_ZONE", undefined);
		expect(() => Clock.system()).toThrow("GYM_TIME_ZONE is not set");
	});

	it("rejects an invalid GYM_TIME_ZONE", () => {
		vi.stubEnv("GYM_TIME_ZONE", "CET");
		expect(() => Clock.system()).toThrow(RangeError);
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
	it("always returns the same instant", () => {
		const instant = Temporal.Instant.from("2025-09-13T10:00:00Z");
		const clock = Clock.fixed(instant);
		expect(clock.instant().equals(instant)).toBe(true);
		expect(clock.instant().equals(instant)).toBe(true);
	});

	it("accepts an ISO instant string", () => {
		const clock = Clock.fixed("2025-09-13T10:00:00Z");
		expect(clock.instant().toString()).toBe("2025-09-13T10:00:00Z");
	});

	it("uses GYM_TIME_ZONE by default and an explicit zone on demand", () => {
		expect(Clock.fixed("2025-09-13T10:00:00Z").timeZone).toBe("Europe/Warsaw");
		expect(Clock.fixed("2025-09-13T10:00:00Z", "Europe/Lisbon").timeZone).toBe(
			"Europe/Lisbon"
		);
	});

	it("rejects a time zone that is not an IANA region", () => {
		expect(() => Clock.fixed("2025-09-13T10:00:00Z", "UTC")).toThrow(
			RangeError
		);
	});
});
