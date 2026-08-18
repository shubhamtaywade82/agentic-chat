"use client"

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

export type AnalystTabKey = "Technical" | "Sentiment" | "News" | "On-Chain"
export type RiskProfileKey = "aggressive" | "neutral" | "conservative"
export type SetupsFilterKey = "ALL" | "LONG" | "SHORT"

interface DashboardState {
  activeSymbol: string
  interval: string
  showEma9: boolean
  showEma21: boolean
  showBollinger: boolean
  analystTab: AnalystTabKey
  riskProfile: RiskProfileKey
  setupsFilter: SetupsFilterKey

  // Actions
  setActiveSymbol: (symbol: string) => void
  setInterval: (interval: string) => void
  setShowEma9: (show: boolean) => void
  setShowEma21: (show: boolean) => void
  setShowBollinger: (show: boolean) => void
  setAnalystTab: (tab: AnalystTabKey) => void
  setRiskProfile: (profile: RiskProfileKey) => void
  setSetupsFilter: (filter: SetupsFilterKey) => void
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      activeSymbol: "BTCUSDT",
      interval: "15m",
      showEma9: true,
      showEma21: true,
      showBollinger: true,
      analystTab: "Technical",
      riskProfile: "neutral",
      setupsFilter: "ALL",

      setActiveSymbol: (activeSymbol) => set({ activeSymbol }),
      setInterval: (interval) => set({ interval }),
      setShowEma9: (showEma9) => set({ showEma9 }),
      setShowEma21: (showEma21) => set({ showEma21 }),
      setShowBollinger: (showBollinger) => set({ showBollinger }),
      setAnalystTab: (analystTab) => set({ analystTab }),
      setRiskProfile: (riskProfile) => set({ riskProfile }),
      setSetupsFilter: (setupsFilter) => set({ setupsFilter }),
    }),
    {
      name: "agentic_futures_dashboard_v1",
      storage: createJSONStorage(() => localStorage),
    }
  )
)
