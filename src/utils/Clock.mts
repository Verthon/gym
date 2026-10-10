export type Clock = Readonly<{
	instant: () => Temporal.Instant;
	timeZone: string;
}>;

const regionTimeZone = (input: string): string => {
	const id = Temporal.Now.zonedDateTimeISO(input).timeZoneId;
	if (!id.includes("/") || id.startsWith("Etc/")) {
		throw new RangeError(
			`Expected an IANA region time zone like "Europe/Warsaw", got "${input}"`
		);
	}
	return id;
};

export const Clock = {
	system: (timeZone: string): Clock => {
		const zone = regionTimeZone(timeZone);
		return {
			instant: () => Temporal.Now.instant(),
			timeZone: zone,
		};
	},
	fixed: (instant: Temporal.Instant, timeZone: string): Clock => ({
		instant: () => instant,
		timeZone,
	}),
};
