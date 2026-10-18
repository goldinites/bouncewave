/** Something that happened, told apart from other kinds of events by its `type`. */
export interface TypedEvent {
  readonly type: string;
}

type Listener<E> = (event: E) => void;

/**
 * Hands every event to whoever subscribed, in the order they subscribed. A listener that throws
 * is reported to `onError` and the others still hear the event, so a failing presentation (a
 * sound the browser refuses, a broken effect) never stops the match or the menus.
 */
export class EventBus<E extends TypedEvent> {
  private readonly listeners: Listener<E>[] = [];
  private readonly onError: (error: unknown) => void;

  /** @param onError where a listener's error goes; rethrown when left out */
  constructor(
    onError: (error: unknown) => void = (error) => {
      throw error;
    },
  ) {
    this.onError = onError;
  }

  /**
   * Hears every event.
   * @returns a function that unsubscribes
   */
  public subscribe(listener: Listener<E>): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) this.listeners.splice(index, 1);
    };
  }

  /**
   * Hears only the events of one `type`, already narrowed to it.
   * @returns a function that unsubscribes
   */
  public on<T extends E['type']>(type: T, listener: Listener<Extract<E, { type: T }>>): () => void {
    return this.subscribe((event) => {
      if (event.type === type) listener(event as Extract<E, { type: T }>);
    });
  }

  public emit(event: E): void {
    // A copy, so a listener that unsubscribes while the event is going round skips nobody
    for (const listener of [...this.listeners]) {
      try {
        listener(event);
      } catch (error) {
        this.onError(error);
      }
    }
  }

  /** Drops every listener. */
  public clear(): void {
    this.listeners.length = 0;
  }
}
