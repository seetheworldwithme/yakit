function getEmbeddedEngineFilename(platform, arch) {
  switch (platform) {
    case 'darwin':
      return arch === 'arm64' ? 'yak_darwin_arm64' : 'yak_darwin_amd64'
    case 'win32':
      return 'yak_windows_amd64.exe'
    case 'linux':
      return arch === 'arm64' ? 'yak_linux_arm64' : 'yak_linux_amd64'
    default:
      return ''
  }
}

function findEmbeddedEngineEntry(entries, platform, arch) {
  const filename = getEmbeddedEngineFilename(platform, arch)
  if (!filename) return ''

  const candidates = [`bins/${filename}`, filename]
  const entryNames = new Set(Object.values(entries).map((entry) => entry.name))
  return candidates.find((candidate) => entryNames.has(candidate)) || ''
}

module.exports = { findEmbeddedEngineEntry, getEmbeddedEngineFilename }
