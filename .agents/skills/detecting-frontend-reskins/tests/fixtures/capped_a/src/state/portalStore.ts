import { create } from 'zustand'
export const usePortalStore = create(() => ({ metrics: { latency: 12, rps: 900 } }))
