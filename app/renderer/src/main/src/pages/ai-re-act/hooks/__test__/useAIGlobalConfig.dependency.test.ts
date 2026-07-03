import fs from 'fs'
import path from 'path'

describe('useAIGlobalConfig dependencies', () => {
  it('does not import AIModelForm just to map model type file names', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../useAIGlobalConfig.ts'), 'utf8')

    expect(source).not.toContain('aiModelForm/AIModelForm')
  })
})
