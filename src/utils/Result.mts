export type Result<T, E> =
	| { success: true; value: T }
	| { success: false; error: E };

export const ok = <T,>(value: T): Result<T, never> => ({ success: true, value });
export const okVoid = (): Result<void, never> => ({
	success: true,
	value: undefined,
});

export const err = <E,>(error: E): Result<never, E> => ({
	success: false,
	error,
});

export const isOk = <T, E>(r: Result<T, E>): r is { success: true; value: T } =>
	r.success;
export const isErr = <T, E>(
	r: Result<T, E>
): r is { success: false; error: E } => !r.success;
