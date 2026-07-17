import { describe, expect, it } from 'vitest'
import { findEmbeddedEngineEntry } from '../embeddedEngineArchive'

describe('findEmbeddedEngineEntry', () => {
  it('accepts the root-level engine produced by the build scripts', () => {
    const entries = {
      yak_darwin_arm64: { name: 'yak_darwin_arm64' },
    }

    expect(findEmbeddedEngineEntry(entries, 'darwin', 'arm64')).toBe('yak_darwin_arm64')
  })

  it('keeps compatibility with archives that contain a bins directory', () => {
    const entries = {
      'bins/yak_windows_amd64.exe': { name: 'bins/yak_windows_amd64.exe' },
    }

    expect(findEmbeddedEngineEntry(entries, 'win32', 'x64')).toBe('bins/yak_windows_amd64.exe')
  })
})
