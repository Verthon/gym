import { describe, it, expect } from "vitest";

import { failWith, success } from "#/utils/test.mts";
import { ContractId } from "../ContractId.mts";

describe("ContractId.create", () => {
	it("rejects empty and blank input", () => {
		failWith(ContractId.create(""), "EMPTY");
		failWith(ContractId.create("   "), "EMPTY");
		failWith(ContractId.create(null), "EMPTY");
	});

	it("trims and compares by value", () => {
		const a = success(ContractId.create(" c-1 "));
		expect(a.toString()).toBe("c-1");
		expect(a.equals(success(ContractId.create("c-1")))).toBe(true);
		expect(a.equals(success(ContractId.create("c-2")))).toBe(false);
	});
});
