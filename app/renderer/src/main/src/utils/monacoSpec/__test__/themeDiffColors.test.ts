import fs from 'fs'
import path from 'path'

describe('Monaco diff theme colors', () => {
  it('uses semantic background and border tokens so changed HTTP lines stay visible', () => {
    const themeSource = fs.readFileSync(path.resolve(__dirname, '../theme.ts'), 'utf8')

    expect(themeSource).toContain("'diffEditor.insertedLineBackground': vars['--Colors-Use-Success-Bg-Hover']")
    expect(themeSource).toContain("'diffEditor.removedLineBackground': vars['--Colors-Use-Error-Bg-Hover']")
    expect(themeSource).toContain("'diffEditor.insertedTextBackground': vars['--Colors-Use-Success-Focus']")
    expect(themeSource).toContain("'diffEditor.removedTextBackground': vars['--Colors-Use-Error-Focus']")
    expect(themeSource).toContain("'diffEditorGutter.insertedLineBackground': vars['--Colors-Use-Success-Border']")
    expect(themeSource).toContain("'diffEditorGutter.removedLineBackground': vars['--Colors-Use-Error-Border']")
  })

  it('chunks large single-line HTTP responses before creating Monaco models', () => {
    const compareSource = fs.readFileSync(path.resolve(__dirname, '../../../pages/compare/DataCompare.tsx'), 'utf8')

    expect(compareSource).toContain("import { prepareDiffText } from './DataCompare.utils'")
    expect(compareSource.match(/content: prepareDiffText\(/g) || []).toHaveLength(2)
  })
})
