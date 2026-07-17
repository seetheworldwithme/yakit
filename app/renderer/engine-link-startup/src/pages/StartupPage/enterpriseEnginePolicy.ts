import { YakitStatusType } from './types'

export type EnterpriseBuiltInEngineAction = 'restore-and-relaunch' | 'restore-and-continue'

/** 企业版只使用安装包内置引擎，不等待隐藏的更新界面交互。 */
export const getEnterpriseBuiltInEngineAction = (
  isEnterprise: boolean,
  status: YakitStatusType,
): EnterpriseBuiltInEngineAction | null => {
  if (!isEnterprise) return null

  if (['install', 'old_version', 'skipAgreement_Install', 'allow-secret-error'].includes(status)) {
    return 'restore-and-relaunch'
  }

  if (status === 'update_yak') return 'restore-and-continue'

  return null
}
