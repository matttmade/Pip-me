import { createContext, useContext } from 'react'
import type { View } from './deviceSettings'

/** Lets on-screen UI (the status bar) switch views without knowing about the stage. */
export type ViewCtx = { view: View; canArm: boolean; setView: (v: View) => void }
export const ViewContext = createContext<ViewCtx>({ view: 'screen', canArm: false, setView: () => {} })
export const useViewCtx = () => useContext(ViewContext)
