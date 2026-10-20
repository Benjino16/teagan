/** Lowercase without accents: “Café” → “cafe”. Umlauts are kept (ä ≠ a). */
function fold(text: string): string {
  // Remove all accents except the diaeresis (U+0308)
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u0307\u0309-\u036f]/g, '').normalize('NFC')
}

/** Whether one of the texts contains the query. An empty query always matches. */
export function matchesSearch(query: string, texts: readonly (string | null | undefined)[]): boolean {
  const needle = fold(query.trim())
  if (!needle) return true
  return texts.some((text) => text != null && fold(text).includes(needle))
}

/** From how many entries a list offers a search – below that, the whole list fits at a glance. */
export const SEARCH_THRESHOLD = 10

/** Whether a list of `count` entries shows a search field. Stays on while a query is entered, so it never vanishes mid-search. */
export function offersSearch(count: number, query = ''): boolean {
  return count >= SEARCH_THRESHOLD || query !== ''
}
