const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const test = require('node:test')

const { readPluginImportArchive } = require('./pluginImport')

test('rejects a directory with an actionable error instead of EISDIR', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'yakit-plugin-import-'))
  try {
    assert.throws(
      () => readPluginImportArchive(directory),
      (error) => error.message.includes('当前选择的是文件夹') && !error.message.includes('EISDIR'),
    )
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('reads zip and encrypted plugin archives', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'yakit-plugin-import-'))
  try {
    for (const extension of ['.zip', '.enc']) {
      const archive = path.join(directory, `plugins${extension}`)
      fs.writeFileSync(archive, Buffer.from('plugin archive'))
      assert.deepEqual(readPluginImportArchive(archive), Buffer.from('plugin archive'))
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})

test('rejects unsupported files before invoking the engine', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'yakit-plugin-import-'))
  try {
    const jsonFile = path.join(directory, 'plugin.json')
    fs.writeFileSync(jsonFile, '{}')
    assert.throws(() => readPluginImportArchive(jsonFile), /仅支持导入 .zip 或 .enc/)
  } finally {
    fs.rmSync(directory, { recursive: true, force: true })
  }
})
