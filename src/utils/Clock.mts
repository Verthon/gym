export type Clock = Readonly<{
	instant: () => Temporal.Instant;
	timeZone: string;
}>;

export const Clock = {
	system: (timeZone: string): Clock => ({
		instant: () => Temporal.Now.instant(),
		timeZone,
	}),
	fixed: (instant: Temporal.Instant, timeZone: string): Clock => ({
		instant: () => instant,
		timeZone,
	}),
};
