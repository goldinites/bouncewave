/** The element with this id; throws if index.html doesn't have it, since nothing works without. */
export function getRequiredElement<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) {
    throw new Error(`Required DOM element with id "${id}" not found`);
  }
  return el as T;
}
