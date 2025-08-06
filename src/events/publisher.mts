import type { DomainEvent } from "./event.mjs";
type Handler<Event extends DomainEvent = DomainEvent> = (e: Event) => void;

export class JustForwardDomainEventPublisher {
	private handlers = new Map<string, Handler[]>();
	publish(e: DomainEvent) {
		(this.handlers.get(e.type) ?? []).forEach((h) => h(e));
	}
	publishMany(es: DomainEvent[]) {
		es.forEach((e) => this.publish(e));
	}
	subscribe<T extends DomainEvent>(type: T["type"], h: Handler<T>) {
		const list = this.handlers.get(type) ?? [];
		list.push(h as Handler);
		this.handlers.set(type, list);
	}
}
