import { describe, expect, it } from 'vitest'
import { getHybridScanErrorMessage } from '@/pages/plugins/pluginBatchExecutor/hybridScanError'

describe('getHybridScanErrorMessage', () => {
  it('explains that unreachable localhost targets are resolved from the scan engine', () => {
    expect(getHybridScanErrorMessage('Has un-reachable targets: 127.0.0.1:5173')).toBe(
      '扫描引擎无法连接目标：127.0.0.1:5173。请先确认目标服务已启动且端口可访问；如果扫描引擎运行在远程主机、WSL 或容器中，请改填扫描引擎能够访问的内网 IP，不要使用 localhost 或 127.0.0.1。',
    )
  })

  it('keeps the original hybrid scan error for unrelated failures', () => {
    expect(getHybridScanErrorMessage('unexpected failure')).toBe('[Mod] hybrid-scan error: unexpected failure')
  })
})
