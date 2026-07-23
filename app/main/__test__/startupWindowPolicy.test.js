import { describe, expect, it } from 'vitest'
import { shouldSkipStartupWindow } from '../startupWindowPolicy'

describe('startup window policy', () => {
  it('keeps the startup window visible for packaged enterprise variants until engine connection succeeds', () => {
    expect(shouldSkipStartupWindow({ isPackaged: true, appName: 'EnpriTrace' })).toBe(false)
    expect(shouldSkipStartupWindow({ isPackaged: true, appName: 'IRifyEnpriTrace' })).toBe(false)
    expect(shouldSkipStartupWindow({ isPackaged: true, appName: 'Memfit AI' })).toBe(false)
  })
})
