import type { PictId } from '../holotapes/pictograms'
import type { WgVal } from '../holotapes/weight'

export type ToolId = 'focus' | 'countdown' | 'stopwatch' | 'convert' | 'calc'
export const TOOLS: { id: ToolId; name: string; icon: PictId; wgVal: WgVal }[] = [
  { id: 'focus', name: 'FOCUS STIM', icon: 'focus', wgVal: { wg: 0.5, val: 40 } },
  { id: 'countdown', name: 'COUNTDOWN', icon: 'countdown', wgVal: { wg: 1, val: 25 } },
  { id: 'stopwatch', name: 'STOPWATCH', icon: 'stopwatch', wgVal: { wg: 1, val: 30 } },
  { id: 'convert', name: 'UNIT SCANNER', icon: 'convert', wgVal: { wg: 2, val: 60 } },
  { id: 'calc', name: 'CALC-O-MATIC', icon: 'calc', wgVal: { wg: 3, val: 75 } },
]
