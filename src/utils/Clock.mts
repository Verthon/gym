export type Clock = Readonly<{
	instant: () => Temporal.Instant;
	timeZone: string;
}>;

const GYM_TIME_ZONE = "GYM_TIME_ZONE";

const regionTimeZone = (input: string): string => {
	const id = Temporal.Now.zonedDateTimeISO(input).timeZoneId;
	if (!id.includes("/") || id.startsWith("Etc/")) {
		throw new RangeError(
			`Expected an IANA region time zone like "Europe/Warsaw", got "${input}"`
		);
	}
	return id;
};

const gymTimeZone = (): string => {
	const zone = process.env[GYM_TIME_ZONE];
	if (zone === undefined) throw new Error(`${GYM_TIME_ZONE} is not set`);
	return zone;
};

export const Clock = {
	system: (timeZone: string = gymTimeZone()): Clock => {
		const zone = regionTimeZone(timeZone);
		return {
			instant: () => Temporal.Now.instant(),
			timeZone: zone,
		};
	},
	fixed: (
		at: Temporal.Instant | string,
		timeZone: string = gymTimeZone()
	): Clock => {
		const instant = Temporal.Instant.from(at);
		const zone = regionTimeZone(timeZone);
		return {
			instant: () => instant,
			timeZone: zone,
		};
	},
};
