import { describe, expect, it } from 'vitest'
import { shouldSkipStartupWindow } from '../startupWindowPolicy'

describe('startup window policy', () => {
  it('keeps the engine startup window hidden for packaged enterprise variants', () => {
    expect(shouldSkipStartupWindow({ isPackaged: true, appName: 'EnpriTrace' })).toBe(true)
    expect(shouldSkipStartupWindow({ isPackaged: true, appName: '靖云甲web应用漏洞扫描' })).toBe(true)
    expect(shouldSkipStartupWindow({ isPackaged: true, appName: 'IRifyEnpriTrace' })).toBe(true)
    expect(shouldSkipStartupWindow({ isPackaged: true, appName: 'Memfit AI' })).toBe(true)
  })
})
