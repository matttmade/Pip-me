import { hashString } from '../../lib/seed'
import type { Holotape } from './types'

const BLOCKED = /^(javascript|data|chrome|chrome-extension|place|about|file|edge|brave|vivaldi|opera):/i

export const holotapeId = (url: string) => 'h' + hashString(url).toString(36)

/** http(s) only; returns the normalized href or null. */
export function normalizeUrl(raw: string): string | null {
  const s = raw.trim()
  if (!s || BLOCKED.test(s)) return null
  try {
    const u = new URL(s)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.href : null
  } catch {
    return null
  }
}

/** Folder path of an <A>: every ancestor <DL> whose previous sibling is an <H3>. */
function folderOf(a: Element): string {
  const parts: string[] = []
  for (let el = a.parentElement; el; el = el.parentElement) {
    if (el.tagName !== 'DL') continue
    const prev = el.previousElementSibling
    if (prev?.tagName === 'H3') parts.unshift((prev.textContent ?? '').trim())
  }
  return parts.filter(Boolean).join(' / ')
}

/** Parse a Chrome/Firefox/Safari "Netscape bookmark file" export into holotapes. */
export function parseBookmarks(html: string): Holotape[] {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const byUrl = new Map<string, Holotape>()
  for (const a of Array.from(doc.querySelectorAll('a[href]'))) {
    const url = normalizeUrl(a.getAttribute('href') ?? '')
    if (!url) continue
    const title = (a.textContent ?? '').replace(/\s+/g, ' ').trim() || domainOf(url)
    const secs = Number(a.getAttribute('add_date'))
    const addedAt = Number.isFinite(secs) && secs > 0 ? secs * 1000 : 0
    const seen = byUrl.get(url)
    if (seen) {
      // duplicate: keep the first title and folder, the earliest date
      if (addedAt && (!seen.addedAt || addedAt < seen.addedAt)) seen.addedAt = addedAt
      continue
    }
    byUrl.set(url, { id: holotapeId(url), title, url, folder: folderOf(a), addedAt })
  }
  return [...byUrl.values()]
}

/** Append new holotapes, skipping URLs already present. */
export function mergeHolotapes(existing: Holotape[], incoming: Holotape[]): { list: Holotape[]; added: number } {
  const have = new Set(existing.map((h) => h.url))
  const fresh: Holotape[] = []
  for (const h of incoming) {
    if (have.has(h.url)) continue
    have.add(h.url)
    fresh.push(h)
  }
  return { list: [...existing, ...fresh], added: fresh.length }
}

export function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
