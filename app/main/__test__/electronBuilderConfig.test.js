const path = require('path')
const fs = require('fs')

describe('electron builder packaging boundaries', () => {
  it('excludes the release output directory from app.asar', () => {
    const configPath = path.resolve(__dirname, '../../../packageScript/electron-builder.config.js')
    const config = require(configPath)

    expect(config.files).toContain('!release/**/*')
  })

  it('prevents concurrent Windows package builds from sharing renderer output', () => {
    const buildScript = fs.readFileSync(path.resolve(__dirname, '../../../build-win-amd64.sh'), 'utf8')

    expect(buildScript).toContain('BUILD_LOCK_DIR=')
    expect(buildScript).toContain('另一个 Windows amd64 打包任务正在运行')
  })
})
