import fs from 'fs'
import path from 'path'
import { transformSync } from '@babel/core'

describe('FuzzerResponseTable production transform', () => {
  it('does not leave an unresolved antd namespace in the table pipeline', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../FuzzerResponseTable.tsx'), 'utf8')
    const transformed = transformSync(source, {
      filename: 'FuzzerResponseTable.tsx',
      babelrc: false,
      configFile: false,
      plugins: [
        [require('@babel/plugin-syntax-typescript'), { isTSX: true }],
        [require('babel-plugin-import'), { libraryName: 'antd', libraryDirectory: 'es', style: 'css' }, 'import'],
      ],
    })

    expect(transformed?.code).not.toMatch(/components\s*:\s*antd\b/)
  })
})
