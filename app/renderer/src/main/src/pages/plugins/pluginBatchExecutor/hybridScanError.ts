const UNREACHABLE_TARGET_PATTERN = /Has un-reachable targets:\s*(.+?)(?:\.$|$)/i

export const getHybridScanErrorMessage = (error: unknown) => {
  const message = String(error || '')
  const unreachableTarget = message.match(UNREACHABLE_TARGET_PATTERN)?.[1]?.trim()

  if (unreachableTarget) {
    return `扫描引擎无法连接目标：${unreachableTarget}。请先确认目标服务已启动且端口可访问；如果扫描引擎运行在远程主机、WSL 或容器中，请改填扫描引擎能够访问的内网 IP，不要使用 localhost 或 127.0.0.1。`
  }

  return `[Mod] hybrid-scan error: ${message}`
}
