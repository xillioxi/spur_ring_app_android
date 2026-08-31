/** First meaningful line from meeting notes as a display title. */
export function titleFromMeetingNotes(notes?: string | null, maxLen = 64): string | null {
  if (!notes?.trim()) return null
  const title = notes
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*#{1,6}\s*/, '').replace(/[*_`]/g, '').trim())
    .find(Boolean)
  if (!title) return null
  return title.length > maxLen ? `${title.slice(0, maxLen)}…` : title
}
