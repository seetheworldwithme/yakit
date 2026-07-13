export const getYakPoCPageTitle = ({ runtimeId }: { runtimeId?: string }) => {
  return runtimeId ? '漏洞详情' : '漏洞检测'
}
