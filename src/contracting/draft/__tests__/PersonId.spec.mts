import { describe, it, expect } from "vitest";

import { PersonId } from "../PersonId.mts";
import { unwrap } from "#/utils/test.mts";

describe("PersonId.create", () => {
	it("creates from trimmed non-empty string with length >= 3", () => {
		const v = unwrap(PersonId.create("  abc  "));
		expect(v.toString()).toBe("abc");
	});

	it("rejects empty or too short", () => {
		expect(PersonId.create("")).toEqual({
			success: false,
			error: { code: "EMPTY" },
		});
		expect(PersonId.create("ab")).toEqual({
			success: false,
			error: { code: "TOO_SHORT", context: { value: "ab" } },
		});
	});
});

describe("PersonId.equals", () => {
	it("compares by value", () => {
		const a = unwrap(PersonId.create("user123"));
		const b = unwrap(PersonId.create("user123"));
		const c = unwrap(PersonId.create("user999"));
		expect(a.equals(b)).toBe(true);
		expect(a.equals(c)).toBe(false);
	});
});
