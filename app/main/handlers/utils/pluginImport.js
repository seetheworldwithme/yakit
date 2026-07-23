const fs = require('fs')
const path = require('path')

const supportedPluginArchiveExtensions = new Set(['.zip', '.enc'])

const readPluginImportArchive = (filename) => {
  const normalizedFilename = typeof filename === 'string' ? filename.trim() : ''
  if (!normalizedFilename) {
    throw new Error('请选择需要导入的插件包（.zip 或 .enc）')
  }

  let stat
  try {
    stat = fs.statSync(normalizedFilename)
  } catch (error) {
    throw new Error(`插件包不存在或无法访问：${normalizedFilename}`)
  }

  if (stat.isDirectory()) {
    throw new Error('当前选择的是文件夹，请选择插件导出的 .zip 或 .enc 文件，不要选择解压后的目录')
  }
  if (!stat.isFile()) {
    throw new Error('所选路径不是可读取的插件包文件')
  }

  const extension = path.extname(normalizedFilename).toLowerCase()
  if (!supportedPluginArchiveExtensions.has(extension)) {
    throw new Error('插件仓库仅支持导入 .zip 或 .enc 格式的插件包')
  }

  return fs.readFileSync(normalizedFilename)
}

module.exports = {
  readPluginImportArchive,
}
