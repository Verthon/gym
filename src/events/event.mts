export type DomainEvent<T extends string = string, P = unknown> = Readonly<{
	type: T;
	payload: Readonly<P>;
	occurredAt: string;
	id?: string;
	correlationId?: string;
	causationId?: string;
}>;
