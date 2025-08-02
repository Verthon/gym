export const unwrap = <T, E> (
	r: { success: true; value: T } | { success: false; error: E }
) => {
	if (!r.success) throw new Error(`Expected success ${JSON.stringify(r.error)}`);
	return r.value;
}
