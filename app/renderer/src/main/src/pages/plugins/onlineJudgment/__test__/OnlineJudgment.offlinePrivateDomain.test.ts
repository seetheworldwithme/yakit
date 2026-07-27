import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

describe('OnlineJudgment private-domain connectivity', () => {
  it('probes the configured private domain even when the browser reports no Internet access', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../OnlineJudgment.tsx'), 'utf8')

    expect(source).toContain("invoke('fetch-netWork-status-by-request-interface')")
    expect(source).not.toContain('useNetwork')
    expect(source).not.toContain('networkState.online')
  })
})
