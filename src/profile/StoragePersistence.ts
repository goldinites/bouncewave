import { MatchEvent } from '@/match/MatchFlow';
import { EventBus } from '@/shared/EventBus';

/**
 * Asks the browser to keep the profile's storage for good. Safari on iOS otherwise wipes a
 * site that isn't installed after seven days without a visit, and other browsers may clear it
 * when space runs short. Asked once the first match is over, when there is something worth
 * keeping: Firefox asks the player, and a question before the first match would only puzzle.
 */
export class StoragePersistence {
  private hasAsked = false;
  private readonly storage: Pick<StorageManager, 'persist' | 'persisted'> | null;

  /** @param storage the browser's; null where it has none */
  constructor(storage: StorageManager | null = globalThis.navigator?.storage ?? null) {
    this.storage = storage;
  }

  /**
   * Asks when a match ends, once.
   * @returns a function that stops listening
   */
  public listenTo(events: EventBus<MatchEvent>): () => void {
    return events.on('gameOver', () => {
      void this.request();
    });
  }

  /** Asks, unless it was asked already or the storage is kept already. */
  public async request(): Promise<void> {
    if (this.hasAsked || !this.storage?.persist) return;
    this.hasAsked = true;
    try {
      if (await this.storage.persisted?.()) return;
      await this.storage.persist();
    } catch {
      // Not granted, or not allowed here: the profile stays as safe as any site's storage
    }
  }
}
