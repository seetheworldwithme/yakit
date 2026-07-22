import fs from 'fs'
import path from 'path'

describe('MITMCertificateDownloadModal', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../MITMCertificateDownloadModal.tsx'), 'utf8')

  it('hides the proxy-access hint while keeping certificate download available', () => {
    expect(source).toContain('证书下载提示按产品要求隐藏，保留代码以备恢复')
    expect(source).toContain('onOk={() => onDown()}')
    expect(source).toContain('ipcRenderer.invoke(apiName, {})')
  })
})
