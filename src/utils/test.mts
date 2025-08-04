import { expect } from "vitest";


export const unwrap = <T, E>(
	r: { success: true; value: T } | { success: false; error: E }
) => {
	if (!r.success)
		throw new Error(`Expected success ${JSON.stringify(r.error)}`);
	return r.value;
};

type Res<T, E> = { success: true; value: T } | { success: false; error: E };

export const success = <T, E>(r: Res<T, E>): T => {
	expect(r).toEqual({ success: true, value: expect.anything() });
	return (r as { success: true; value: T }).value;
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
