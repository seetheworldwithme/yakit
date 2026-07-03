import React, { useMemo } from 'react'
import {
  SentinelHomeAIAgentIcon,
  SentinelHomeAuditCodeIcon,
  SentinelHomeAuditHoleIcon,
  SentinelHomeBatchPluginIcon,
  SentinelHomeBruteIcon,
  SentinelHomeCVEIcon,
  SentinelHomeCodeScanIcon,
  SentinelHomeCodecIcon,
  SentinelHomeDNSLogIcon,
  SentinelHomeDataCompareIcon,
  SentinelHomeDirectoryScanIcon,
  SentinelHomeDomainAssetsIcon,
  SentinelHomeHistoryIcon,
  SentinelHomeICMPSizeLogIcon,
  SentinelHomeKnowledgeBaseIcon,
  SentinelHomeMitmIcon,
  SentinelHomePayloadGeneraterIcon,
  SentinelHomePluginHubIcon,
  SentinelHomePocIcon,
  SentinelHomePortAssetsIcon,
  SentinelHomePortListenerIcon,
  SentinelHomeProjectManagerIcon,
  SentinelHomeReportIcon,
  SentinelHomeReverseServerIcon,
  SentinelHomeRiskIcon,
  SentinelHomeRuleManagementIcon,
  SentinelHomeScanPortIcon,
  SentinelHomeTCPPortLogIcon,
  SentinelHomeWebFuzzerIcon,
} from '@/assets/icon/sentinelHome/SentinelHomeIcons'
import { useMemoizedFn } from 'ahooks'
import { RouteToPageProps } from './PublicMenu'
import { Tooltip } from 'antd'
import { YakitRouteToPageInfo, ResidentPluginName } from '@/routes/newRoute'
import { YakitRoute } from '@/enums/yakitRoute'
import { isIRify } from '@/utils/envfile'
import { useI18nNamespaces } from '@/i18n/useI18nNamespaces'

import classNames from 'classnames'
import styles from './MenuMode.module.scss'
import { useHttpFlowStore } from '@/store/httpFlow'

interface MenuModeProps {
  mode: string
  pluginToId: Record<ResidentPluginName, number>
  onMenuSelect: (route: RouteToPageProps) => void
}

export const MenuMode: React.FC<MenuModeProps> = React.memo((props) => {
  const { mode, pluginToId, onMenuSelect } = props
  const { t, i18n } = useI18nNamespaces(['yakitRoute', 'layout'])
  const { resetCompareData } = useHttpFlowStore()
  /** 转换成菜单组件统一处理的数据格式，插件是否下载的验证由菜单组件处理，这里不处理 */
  const onMenu = useMemoizedFn((page: YakitRoute, pluginId?: number, pluginName?: string) => {
    if (!page) return

    if (page === YakitRoute.Plugin_OP) {
      onMenuSelect({
        route: page,
        pluginId: pluginId || 0,
        pluginName: pluginName || '',
      })
    } else {
      //点击数据对比tab新增一个对比页 所以需要清除store数据
      page === YakitRoute.DataCompare && resetCompareData()
      onMenuSelect({ route: page })
    }
  })

  const tooltipTitle = useMemoizedFn((route: YakitRoute) => {
    return YakitRouteToPageInfo[route].labelUi
      ? t(YakitRouteToPageInfo[route].labelUi as string)
      : YakitRouteToPageInfo[route].label
  })

  return (
    <div className={styles['menu-mode-wrapper']}>
      {mode === '渗透测试' && (
        <>
          <div className={styles['vertical-menu-wrapper']} onClick={() => onMenu(YakitRoute.MITMHacker)}>
            <div className={styles['menu-icon-wrapper']}>
              <div className={styles['icon-wrapper']}>
                <SentinelHomeMitmIcon />
              </div>
            </div>
            <div className={styles['title-style']}>MITM</div>
          </div>
          <div className={styles['divider-style']}></div>
          <div className={styles['vertical-menu-wrapper']} onClick={() => onMenu(YakitRoute.HTTPFuzzer)}>
            <div className={styles['menu-icon-wrapper']}>
              <div className={styles['icon-wrapper']}>
                <SentinelHomeWebFuzzerIcon />
              </div>
            </div>
            <div className={styles['title-style']}>{tooltipTitle(YakitRoute.HTTPFuzzer)}</div>
          </div>
          <div className={styles['divider-style']}></div>
          <div>
            <div className={styles['horizontal-menu-wrapper']} onClick={() => onMenu(YakitRoute.Codec)}>
              <div className={styles['icon-wrapper']}>
                <SentinelHomeCodecIcon />
              </div>
              <div className={styles['title-style']}>{t('YakitRoute.Codec')}</div>
            </div>
            <div className={styles['horizontal-menu-wrapper']} onClick={() => onMenu(YakitRoute.DataCompare)}>
              <div className={styles['icon-wrapper']}>
                <SentinelHomeDataCompareIcon />
              </div>
              <div className={styles['title-style']}>{t('YakitRoute.dataCompare')}</div>
            </div>
          </div>
        </>
      )}
      {mode === '安全工具' && (
        <>
          <div className={styles['vertical-menu-wrapper']} onClick={() => onMenu(YakitRoute.Mod_ScanPort)}>
            <div className={styles['menu-icon-wrapper']}>
              <div className={styles['icon-wrapper']}>
                <SentinelHomeScanPortIcon />
              </div>
            </div>
            <div className={styles['title-style']}>{t('YakitRoute.portAndFingerprintScan')}</div>
          </div>
          <div className={styles['divider-style']}></div>
          <div className={styles['vertical-menu-wrapper']} onClick={() => onMenu(YakitRoute.PoC)}>
            <div className={styles['menu-icon-wrapper']}>
              <div className={styles['icon-wrapper']}>
                <SentinelHomePocIcon />
              </div>
            </div>
            <div className={styles['title-style']}>{t('YakitRoute.vulnTargetedScan')}</div>
          </div>
          <div className={styles['divider-style']}></div>
          <div className={styles['parent-menu-wrapper']} onClick={() => onMenu(YakitRoute.Mod_Brute)}>
            <div className={styles['childs-menu-wrapper']}>
              <Tooltip placement="bottom" title={tooltipTitle(YakitRoute.Mod_Brute)}>
                <div
                  className={classNames(styles['icon-wrapper'], styles['child-icon-wrapper'])}
                  onClick={(e) => {
                    e.stopPropagation()
                    onMenu(YakitRoute.Mod_Brute)
                  }}
                >
                  <SentinelHomeBruteIcon />
                </div>
              </Tooltip>
              <Tooltip placement="bottom" title={t('YakitRoute.directoryScan')}>
                <div
                  className={classNames(styles['icon-wrapper'], styles['child-icon-wrapper'], {
                    [styles['disable-style']]: pluginToId[ResidentPluginName.DirectoryScanning] === 0,
                  })}
                  onClick={(e) => {
                    e.stopPropagation()
                    onMenu(
                      YakitRoute.Plugin_OP,
                      pluginToId[ResidentPluginName.DirectoryScanning],
                      ResidentPluginName.DirectoryScanning,
                    )
                  }}
                >
                  <SentinelHomeDirectoryScanIcon />
                </div>
              </Tooltip>
            </div>
            <div className={styles['title-style']}>
              {t('Layout.MenuMode.bruteForce')}
              {t('Layout.MenuMode.and')}
              {i18n.language === 'en' ? <br /> : null}
              {t('Layout.MenuMode.unauthorizedCheck')}
            </div>
          </div>
        </>
      )}
      {mode === '插件' && (
        <>
          <div className={styles['vertical-menu-wrapper']} onClick={() => onMenu(YakitRoute.Plugin_Hub)}>
            <div className={styles['menu-icon-wrapper']}>
              <div className={styles['icon-wrapper']}>
                <SentinelHomePluginHubIcon />
              </div>
            </div>
            <div className={styles['title-style']}>{t('YakitRoute.pluginHub')}</div>
          </div>

          <div className={styles['divider-style']}></div>
          <div className={styles['vertical-menu-wrapper']} onClick={() => onMenu(YakitRoute.BatchExecutorPage)}>
            <div className={styles['menu-icon-wrapper']}>
              <div className={styles['icon-wrapper']}>
                <SentinelHomeBatchPluginIcon />
              </div>
            </div>
            <div className={styles['title-style']}>{t('YakitRoute.batchExecute')}</div>
          </div>
        </>
      )}
      {mode === '反连' && (
        <>
          <div className={styles['parent-menu-wrapper']} onClick={() => onMenu(YakitRoute.DNSLog)}>
            <div className={styles['childs-menu-wrapper']}>
              <Tooltip placement="bottom" title={tooltipTitle(YakitRoute.DNSLog)}>
                <div
                  className={classNames(styles['icon-wrapper'], styles['child-icon-wrapper'])}
                  onClick={(e) => {
                    e.stopPropagation()
                    onMenu(YakitRoute.DNSLog)
                  }}
                >
                  <SentinelHomeDNSLogIcon />
                </div>
              </Tooltip>
              <Tooltip placement="bottom" title={tooltipTitle(YakitRoute.ICMPSizeLog)}>
                <div
                  className={classNames(styles['icon-wrapper'], styles['child-icon-wrapper'])}
                  onClick={(e) => {
                    e.stopPropagation()
                    onMenu(YakitRoute.ICMPSizeLog)
                  }}
                >
                  <SentinelHomeICMPSizeLogIcon />
                </div>
              </Tooltip>
              <Tooltip placement="bottom" title={tooltipTitle(YakitRoute.TCPPortLog)}>
                <div
                  className={classNames(styles['icon-wrapper'], styles['child-icon-wrapper'])}
                  onClick={(e) => {
                    e.stopPropagation()
                    onMenu(YakitRoute.TCPPortLog)
                  }}
                >
                  <SentinelHomeTCPPortLogIcon />
                </div>
              </Tooltip>
            </div>
            <div className={styles['title-style']}>{t('YakitRoute.reverseTrigger')}</div>
          </div>
          <div className={styles['divider-style']}></div>
          <div className={styles['parent-menu-wrapper']} onClick={() => onMenu(YakitRoute.PayloadGenerater_New)}>
            <div className={styles['childs-menu-wrapper']}>
              <Tooltip placement="bottom" title={tooltipTitle(YakitRoute.PayloadGenerater_New)}>
                <div
                  className={classNames(styles['icon-wrapper'], styles['child-icon-wrapper'])}
                  onClick={(e) => {
                    e.stopPropagation()
                    onMenu(YakitRoute.PayloadGenerater_New)
                  }}
                >
                  <SentinelHomePayloadGeneraterIcon />
                </div>
              </Tooltip>
              <Tooltip placement="bottom" title={tooltipTitle(YakitRoute.ReverseServer_New)}>
                <div
                  className={classNames(styles['icon-wrapper'], styles['child-icon-wrapper'])}
                  onClick={(e) => {
                    e.stopPropagation()
                    onMenu(YakitRoute.ReverseServer_New)
                  }}
                >
                  <SentinelHomeReverseServerIcon />
                </div>
              </Tooltip>
            </div>
            <div className={styles['title-style']}>{t('YakitRoute.revHack')}</div>
          </div>
          <div className={styles['divider-style']}></div>
          <div className={styles['vertical-menu-wrapper']} onClick={() => onMenu(YakitRoute.ShellReceiver)}>
            <div className={styles['menu-icon-wrapper']}>
              <div className={styles['icon-wrapper']}>
                <SentinelHomePortListenerIcon />
              </div>
            </div>
            <div className={styles['title-style']}>{t('YakitRoute.portListener')}</div>
          </div>
        </>
      )}
      {mode === '代码审计' && (
        <>
          <div className={styles['vertical-menu-wrapper']} onClick={() => onMenu(YakitRoute.YakRunner_Project_Manager)}>
            <div className={styles['menu-icon-wrapper']}>
              <div className={styles['icon-wrapper']}>
                <SentinelHomeProjectManagerIcon />
              </div>
            </div>
            <div className={styles['title-style']}>{t('YakitRoute.projectManagement')}</div>
          </div>
          <div className={styles['divider-style']}></div>
          <div className={styles['vertical-menu-wrapper']} onClick={() => onMenu(YakitRoute.YakRunner_Audit_Code)}>
            <div className={styles['menu-icon-wrapper']}>
              <div className={styles['icon-wrapper']}>
                <SentinelHomeAuditCodeIcon />
              </div>
            </div>
            <div className={styles['title-style']}>{t('YakitRoute.codeAudit')}</div>
          </div>
          <div className={styles['divider-style']}></div>
          <div className={styles['vertical-menu-wrapper']} onClick={() => onMenu(YakitRoute.Irify_AI_Code_Audit)}>
            <div className={styles['menu-icon-wrapper']}>
              <div className={styles['icon-wrapper']}>
                <SentinelHomeAIAgentIcon />
              </div>
            </div>
            <div className={styles['title-style']}>{t('YakitRoute.irifyAiCodeAudit')}</div>
          </div>
          <div className={styles['divider-style']}></div>
          <div className={styles['vertical-menu-wrapper']} onClick={() => onMenu(YakitRoute.YakRunner_Code_Scan)}>
            <div className={styles['menu-icon-wrapper']}>
              <div className={styles['icon-wrapper']}>
                <SentinelHomeCodeScanIcon />
              </div>
            </div>
            <div className={styles['title-style']}>{t('YakitRoute.codeScan')}</div>
          </div>
          <div className={styles['divider-style']}></div>
          <div className={styles['vertical-menu-wrapper']} onClick={() => onMenu(YakitRoute.Rule_Management)}>
            <div className={styles['menu-icon-wrapper']}>
              <div className={styles['icon-wrapper']}>
                <SentinelHomeRuleManagementIcon />
              </div>
            </div>
            <div className={styles['title-style']}>{t('YakitRoute.ruleManagement')}</div>
          </div>
          <div className={styles['divider-style']}></div>
          <div className={styles['vertical-menu-wrapper']} onClick={() => onMenu(YakitRoute.YakRunner_Audit_Hole)}>
            <div className={styles['menu-icon-wrapper']}>
              <div className={styles['icon-wrapper']}>
                <SentinelHomeAuditHoleIcon />
              </div>
            </div>
            <div className={styles['title-style']}>{t('YakitRoute.auditVulnerability')}</div>
          </div>
          <div className={styles['divider-style']}></div>
          <div className={styles['vertical-menu-wrapper']} onClick={() => onMenu(YakitRoute.Yak_Java_Decompiler)}>
            <div className={styles['menu-icon-wrapper']}>
              <div className={styles['icon-wrapper']}>
                <SentinelHomeAuditHoleIcon />
              </div>
            </div>
            <div className={styles['title-style']}>{t('YakitRoute.javaDecompile')}</div>
          </div>
        </>
      )}
      {mode === '数据库' && (
        <>
          {isIRify() ? (
            <div className={styles['multiple-vertical-menu-wrapper']}>
              <div className={styles['vertical-menu-wrapper']} onClick={() => onMenu(YakitRoute.DB_Report)}>
                <div className={styles['menu-icon-wrapper']}>
                  <div className={styles['icon-wrapper']}>
                    <SentinelHomeReportIcon />
                  </div>
                </div>
                <div className={styles['title-style']}>{t('YakitRoute.report')}</div>
              </div>
            </div>
          ) : (
            <>
              <div className={styles['vertical-menu-wrapper']} onClick={() => onMenu(YakitRoute.DB_HTTPHistory)}>
                <div className={styles['menu-icon-wrapper']}>
                  <div className={styles['icon-wrapper']}>
                    <SentinelHomeHistoryIcon />
                  </div>
                </div>
                <div className={styles['title-style']}>{t('YakitRoute.History')}</div>
              </div>
              <div className={styles['divider-style']}></div>
              <div className={styles['multiple-vertical-menu-wrapper']}>
                <div className={styles['vertical-menu-wrapper']} onClick={() => onMenu(YakitRoute.DB_Report)}>
                  <div className={styles['menu-icon-wrapper']}>
                    <div className={styles['icon-wrapper']}>
                      <SentinelHomeReportIcon />
                    </div>
                  </div>
                  <div className={styles['title-style']}>{t('YakitRoute.report')}</div>
                </div>
                <div className={styles['vertical-menu-wrapper']} onClick={() => onMenu(YakitRoute.DB_Risk)}>
                  <div className={styles['menu-icon-wrapper']}>
                    <div className={styles['icon-wrapper']}>
                      <SentinelHomeRiskIcon />
                    </div>
                  </div>
                  <div className={styles['title-style']}>{t('YakitRoute.vulnerability')}</div>
                </div>
                <div className={styles['vertical-menu-wrapper']} onClick={() => onMenu(YakitRoute.DB_Ports)}>
                  <div className={styles['menu-icon-wrapper']}>
                    <div className={styles['icon-wrapper']}>
                      <SentinelHomePortAssetsIcon />
                    </div>
                  </div>
                  <div className={styles['title-style']}>{t('YakitRoute.port')}</div>
                </div>
                <div className={styles['vertical-menu-wrapper']} onClick={() => onMenu(YakitRoute.DB_Domain)}>
                  <div className={styles['menu-icon-wrapper']}>
                    <div className={styles['icon-wrapper']}>
                      <SentinelHomeDomainAssetsIcon />
                    </div>
                  </div>
                  <div className={styles['title-style']}>{t('YakitRoute.domain')}</div>
                </div>
              </div>
              <div className={styles['divider-style']}></div>
              <div className={styles['vertical-menu-wrapper']} onClick={() => onMenu(YakitRoute.DB_CVE)}>
                <div className={styles['menu-icon-wrapper']}>
                  <div className={styles['icon-wrapper']}>
                    <SentinelHomeCVEIcon />
                  </div>
                </div>
                <div className={styles['title-style']}>{t('YakitRoute.cVEManagement')}</div>
              </div>
            </>
          )}
        </>
      )}
      {mode === 'AI' && (
        <>
          <div className={styles['vertical-menu-wrapper']} onClick={() => onMenu(YakitRoute.AI_Agent)}>
            <div className={styles['menu-icon-wrapper']}>
              <div className={styles['icon-wrapper']}>
                <SentinelHomeAIAgentIcon />
              </div>
            </div>
            <div className={styles['title-style']}>{t('YakitRoute.AIAgent')}</div>
          </div>
          <div className={styles['divider-style']}></div>
          <div className={styles['vertical-menu-wrapper']} onClick={() => onMenu(YakitRoute.AI_REPOSITORY)}>
            <div className={styles['menu-icon-wrapper']}>
              <div className={styles['icon-wrapper']}>
                <SentinelHomeKnowledgeBaseIcon />
              </div>
            </div>
            <div className={styles['title-style']}>{t('YakitRoute.ai-repository')}</div>
          </div>
        </>
      )}
    </div>
  )
})
