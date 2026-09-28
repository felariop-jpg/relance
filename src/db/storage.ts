let requested = false;

/**
 * Asks the browser not to clear this site's data under storage pressure.
 * Called only after the user has added contacts, never on page load.
 */
export async function requestPersistentStorage(): Promise<void> {
  if (requested) return;
  requested = true;
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return;
    if (await navigator.storage.persisted()) return;
    await navigator.storage.persist();
  } catch {
    // Not supported or refused: data still works, it is just evictable.
  }
}
