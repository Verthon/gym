import { assert, expect } from "vitest";


export const unwrap = <T,>(
	r: { success: true; value: T } | { success: false; error: unknown }
) => {
	if (!r.success)
		throw new Error(`Expected success ${JSON.stringify(r.error)}`);
	return r.value;
};

type Res<T, E> = { success: true; value: T } | { success: false; error: E };

export const success = <T,>(r: Res<T, unknown>): T => {
	assert(r.success, `Expected success, got ${JSON.stringify(r)}`);
	return r.value;
};

export const failWith = <T, E extends { code: string }>(
	r: Res<T, E>,
	code: E["code"]
) => {
	expect(r).toEqual({
		success: false,
		error: expect.objectContaining({ code }),
	});
};
