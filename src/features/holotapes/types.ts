export type Holotape = {
  id: string
  title: string
  url: string
  /** Folder path joined with " / " ("" for top level). */
  folder: string
  /** Epoch ms (0 when unknown). */
  addedAt: number
  uses?: number
}

/** A pinned quick link in INV > AID. */
export type AidItem = { id: string; title: string; url: string; uses: number; pinnedAt: number }

export const HOLOTAPES_KEY = 'holotapes'
export const AID_KEY = 'aid'
export const NO_HOLOTAPES: Holotape[] = []
export const NO_AID: AidItem[] = []
