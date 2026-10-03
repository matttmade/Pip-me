/** Field notes: pure state + reducer. Newest-edited first. */

export type Note = { id: string; title: string; body: string; createdAt: number; updatedAt: number }

/**
 * Notes are the one thing in INV the owner writes by hand, so they live under a `saved:` key:
 * localStorage, kept across browser restarts and through RESET TERMINAL (see lib/store.ts).
 */
export const NOTES_KEY = 'saved:notes'
export const NO_NOTES: Note[] = []
export const TITLE_MAX = 60
export const BODY_MAX = 4000
export const NOTES_MAX = 200

export type NoteAction =
  | { type: 'add'; id: string; title: string; body: string; now: number }
  | { type: 'update'; id: string; title: string; body: string; now: number }
  | { type: 'delete'; id: string }

/** "UNTITLED" fallback: first words of the body, else a dated label. */
export function titleFor(title: string, body: string, now: number): string {
  const t = title.trim().slice(0, TITLE_MAX)
  if (t) return t
  const first = body.trim().split(/\n/)[0]?.trim() ?? ''
  if (first) return first.length > 32 ? `${first.slice(0, 31).trimEnd()}…` : first
  const d = new Date(now)
  return `ENTRY ${d.getMonth() + 1}.${d.getDate()}`
}

export function notesReducer(notes: Note[], a: NoteAction): Note[] {
  switch (a.type) {
    case 'add': {
      const note: Note = { id: a.id, title: titleFor(a.title, a.body, a.now), body: a.body.slice(0, BODY_MAX), createdAt: a.now, updatedAt: a.now }
      return [note, ...notes.filter((n) => n.id !== a.id)].slice(0, NOTES_MAX)
    }
    case 'update': {
      const old = notes.find((n) => n.id === a.id)
      if (!old) return notes
      const next = { ...old, title: titleFor(a.title, a.body, a.now), body: a.body.slice(0, BODY_MAX), updatedAt: a.now }
      if (next.title === old.title && next.body === old.body) return notes
      return [next, ...notes.filter((n) => n.id !== a.id)]
    }
    case 'delete':
      return notes.some((n) => n.id === a.id) ? notes.filter((n) => n.id !== a.id) : notes
  }
}

export function searchNotes(notes: Note[], query: string): Note[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (!words.length) return notes
  return notes.filter((n) => {
    const hay = `${n.title}\n${n.body}`.toLowerCase()
    return words.every((w) => hay.includes(w))
  })
}

export const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length

export const newNoteId = (now: number, rand = Math.random()) => `n${now.toString(36)}${Math.floor(rand * 1296).toString(36)}`
