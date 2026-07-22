import fs from 'fs'
import path from 'path'

describe('HubListOnline single download feedback', () => {
  it('notifies the user when a cloud plugin finishes downloading', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../HubListOnline.tsx'), 'utf8')
    const downloadHandler = source.slice(
      source.indexOf('const handleSingleDownload'),
      source.indexOf('const [allDownloadHint'),
    )

    expect(downloadHandler).toContain("yakitNotify('success', t('PluginHubDetail.downloadSuccess'))")
  })
})
