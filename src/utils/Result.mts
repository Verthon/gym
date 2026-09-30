/**
 * Result for better readability
 * 
 * Returns Result<T,E> instead of throwing.
 * See [architecture/error-handling-strategy.md](../../architecture/error-handling-strategy.md).
 */
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
