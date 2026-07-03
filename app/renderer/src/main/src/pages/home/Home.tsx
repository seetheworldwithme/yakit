import React, { useEffect, useMemo, useRef, useState, ReactElement, CSSProperties } from 'react'
import classNames from 'classnames'
import {
  PublicBatchExecutorIcon,
  PublicBruteIcon,
  PublicCodecIcon,
  PublicDNSLogIcon,
  PublicDirectoryScanningIcon,
  PublicInformationGatheringIcon,
  PublicPayloadGeneraterIcon,
  PublicPayloadManagerIcon,
  PublicPluginLocalIcon,
  PublicPluginMineIcon,
  PublicPluginStoreIcon,
  PublicPocIcon,
  PublicScanPortIcon,
  PublicToolCVEIcon,
  PublicToolDBDomainIcon,
  PublicToolDBHTTPHistoryIcon,
  PublicToolDBReportIcon,
  PublicToolDBRiskIcon,
  PublicToolDataCompareIcon,
  PublicToolICMPSizeLogIcon,
  PublicToolModScanPortIcon,
  PublicToolPayloadIcon,
  PublicToolPluginHubIcon,
  PublicToolReverseServerIcon,
  PublicToolShellReceiverIcon,
  PublicToolTCPPortLogIcon,
} from '@/routes/publicIcon'
import { YakitButton } from '@/components/yakitUI/YakitButton/YakitButton'
import { SolidCheckIcon, SolidExclamationIcon, SolidPlayIcon } from '@/assets/icon/solid'
import { OutlineArrowrightIcon, OutlineChevronupIcon } from '@/assets/icon/outline'
import { YakitRoute } from '@/enums/yakitRoute'
import emiter from '@/utils/eventBus/eventBus'
import { RouteToPageProps } from '../layout/publicMenu/PublicMenu'
import { usePluginToId } from '@/store/publicMenu'
import { ResidentPluginName } from '@/routes/newRoute'
import { Tooltip } from 'antd'
import { useDebounceEffect, useGetState, useInViewport, useMemoizedFn, useSize, useThrottleFn } from 'ahooks'
import { getRemoteValue, setRemoteValue } from '@/utils/kv'
import { RemoteGV } from '@/yakitGV'
import { yakitNotify } from '@/utils/notification'
import { YakitSystem } from '@/yakitGVDefine'
import { YakitHint } from '@/components/yakitUI/YakitHint/YakitHint'
import { ShieldCheckIcon as AllShieldCheckIcon } from '@/components/layout/globalStateIcon'
import { getReleaseEditionName, isCommunityYakit, isEnpriTrace } from '@/utils/envfile'
import ReactResizeDetector from 'react-resize-detector'
import { PluginHubPageInfoProps } from '@/store/pageInfo'
import { YakitTag } from '@/components/yakitUI/YakitTag/YakitTag'
import { useI18nNamespaces } from '@/i18n/useI18nNamespaces'
import { useSoftMode, YakitModeEnum } from '@/store/softMode'
import styles from './home.module.scss'

const { ipcRenderer } = window.require('electron')

interface ToolInfo {
  label: string
  icon: ReactElement
  iconStyle?: CSSProperties
  desc: string
  rightIcon: ReactElement
  onClick: () => void
}

interface HomeProp {}
const Home: React.FC<HomeProp> = (props) => {
  const { t, i18n } = useI18nNamespaces(['yakitUi', 'yakitRoute', 'home'])
  const { softMode } = useSoftMode()
  const homeRef = useRef(null)
  const [inViewport] = useInViewport(homeRef)
  const { pluginToId } = usePluginToId()
  const isRunRef = useRef<boolean>(false)
  const [timeInterval, setTimeInterval, getTimeInterval] = useGetState<number>(5)
  const timeRef = useRef<any>(null)
  const [scanningCheck, setScanningCheck] = useState<string>('specialVulnerabilityDetection')
  const [showScanningDropdown, setShowScanningDropdown] = useState<boolean>(false)
  const scanningdropdownRef = useRef<HTMLDivElement>(null)
  const [pcap, setPcap] = useState<{
    IsPrivileged: boolean
    Advice: string
    AdviceVerbose: string
  }>({ Advice: 'unknown', AdviceVerbose: t('Home.pcapSupportInfoFailed'), IsPrivileged: false })
  const [system, setSystem] = useState<YakitSystem>('Darwin')
  const [pcapHintShow, setPcapHintShow] = useState<boolean>(false)
  const [pcapResult, setPcapResult] = useState<boolean>(false)
  const [pcapHintLoading, setPcapHintLoading] = useState<boolean>(false)
  // 首页工具网格统一数据源：原 signle-jump 三个小按钮(Yso-Java Hack / DNSLog / Codec) + 原工具箱工具列表
  const toolsList = useMemo(() => {
    return [
      {
        label: t('YakitRoute.Yso-Java Hack'),
        icon: <PublicPayloadGeneraterIcon />,
        desc: t('YakitRoute.fuzzPayLoadDeserialization'),
        rightIcon: <OutlineArrowrightIcon />,
        onClick: () => onMenu({ route: YakitRoute.PayloadGenerater_New }),
      },
      {
        label: t('YakitRoute.DNSLog'),
        icon: <PublicDNSLogIcon />,
        desc: t('YakitRoute.subdomainAutoGenerate'),
        rightIcon: <OutlineArrowrightIcon />,
        onClick: () => onMenu({ route: YakitRoute.DNSLog }),
      },
      {
        label: t('YakitRoute.Codec'),
        icon: <PublicCodecIcon />,
        desc: t('Home.codecPluginCustom'),
        rightIcon: <OutlineArrowrightIcon />,
        onClick: () => onMenu({ route: YakitRoute.Codec }),
      },
      {
        label: t('YakitRoute.Payload'),
        icon: <PublicToolPayloadIcon />,
        desc: t('YakitRoute.customPayload'),
        rightIcon: <OutlineArrowrightIcon />,
        onClick: () => onMenu({ route: YakitRoute.PayloadManager }),
      },
      {
        label: t('YakitRoute.dataCompare'),
        icon: <PublicToolDataCompareIcon />,
        desc: t('YakitRoute.quicklyIdentifyDifferencesInData'),
        rightIcon: <OutlineArrowrightIcon />,
        onClick: () => onMenu({ route: YakitRoute.DataCompare }),
      },
      {
        label: t('YakitRoute.cVEManagement'),
        icon: <PublicToolCVEIcon />,
        desc: t('YakitRoute.searchAndQueryCVEData'),
        rightIcon: <OutlineArrowrightIcon />,
        onClick: () => onMenu({ route: YakitRoute.DB_CVE }),
      },
      {
        label: t('YakitRoute.pluginHub'),
        icon: <PublicToolPluginHubIcon />,
        iconStyle: { backgroundColor: '#F4736B', padding: 1 },
        desc: t('YakitRoute.massiveYakitPluginsOne-ClickDownload', { edition: getReleaseEditionName() }),
        rightIcon: <OutlineArrowrightIcon />,
        onClick: () => onMenu({ route: YakitRoute.Plugin_Hub }),
      },
      {
        label: t('YakitRoute.portListener'),
        icon: <PublicToolShellReceiverIcon />,
        desc: t('YakitRoute.reverseShellTool'),
        rightIcon: <OutlineArrowrightIcon />,
        onClick: () => onMenu({ route: YakitRoute.ShellReceiver }),
      },
      {
        label: t('YakitRoute.ICMP-SizeLog'),
        icon: <PublicToolICMPSizeLogIcon />,
        desc: t('YakitRoute.detectICMPCallbackViaPingWithSpecificPacketSize'),
        rightIcon: <OutlineArrowrightIcon />,
        onClick: () => onMenu({ route: YakitRoute.ICMPSizeLog }),
      },
      {
        label: t('YakitRoute.TCP-PortLog'),
        icon: <PublicToolTCPPortLogIcon />,
        desc: t('YakitRoute.detectTCPCallbackViaRandomClosedPorts'),
        rightIcon: <OutlineArrowrightIcon />,
        onClick: () => onMenu({ route: YakitRoute.TCPPortLog }),
      },
      {
        label: t('YakitRoute.reverseServer'),
        icon: <PublicToolReverseServerIcon />,
        desc: t('YakitRoute.simultaneouslyProvideHTTP/RMI/HTTPSReverseConnectionsOnOnePort'),
        rightIcon: <OutlineArrowrightIcon />,
        onClick: () => onMenu({ route: YakitRoute.ReverseServer_New }),
      },
      {
        label: t('YakitRoute.History'),
        icon: <PublicToolDBHTTPHistoryIcon />,
        desc: t('YakitRoute.viewAndManageAllHistoricalTrafficFromMITMPluginsAndFuzzing'),
        rightIcon: <OutlineArrowrightIcon />,
        onClick: () => onMenu({ route: YakitRoute.DB_HTTPHistory }),
      },
      {
        label: t('YakitRoute.report'),
        icon: <PublicToolDBReportIcon />,
        desc: t('YakitRoute.viewAndManageReportsGeneratedDuringScanning'),
        rightIcon: <OutlineArrowrightIcon />,
        onClick: () => onMenu({ route: YakitRoute.DB_Report }),
      },
      {
        label: t('Home.vulnerabilityRiskStatistics'),
        icon: <PublicToolDBRiskIcon />,
        desc: t('YakitRoute.manageAllDetectedVulnerabilitiesAndRisks'),
        rightIcon: <OutlineArrowrightIcon />,
        onClick: () => onMenu({ route: YakitRoute.DB_Risk }),
      },
      {
        label: t('YakitRoute.portAssets'),
        icon: <PublicToolModScanPortIcon />,
        desc: t('YakitRoute.manageAllDiscoveredPortAssets'),
        rightIcon: <OutlineArrowrightIcon />,
        onClick: () => onMenu({ route: YakitRoute.DB_Ports }),
      },
      {
        label: t('YakitRoute.domainAssets'),
        icon: <PublicToolDBDomainIcon />,
        desc: t('YakitRoute.manageAllDiscoveredDomainAssets'),
        rightIcon: <OutlineArrowrightIcon />,
        onClick: () => onMenu({ route: YakitRoute.DB_Domain }),
      },
    ] as ToolInfo[]
  }, [i18n.language, pluginToId])
  const isScanMode = useMemo(() => {
    return isCommunityYakit() && softMode === YakitModeEnum.Scan
  }, [softMode])

  useEffect(() => {
    let timer: any = null
    getRemoteValue(RemoteGV.GlobalStateTimeInterval).then((time: any) => {
      setTimeInterval(+time || 5)
      if ((+time || 5) > 5) updateAllInfo()
      if (timer) clearInterval(timer)
      timer = setInterval(() => {
        setRemoteValue(RemoteGV.GlobalStateTimeInterval, `${getTimeInterval()}`)
      }, 20000)
    })

    getRemoteValue(RemoteGV.HomeStartScanning).then((e) => {
      if (!!e) {
        setScanningCheck(e)
      } else {
        setScanningCheck('specialVulnerabilityDetection')
      }
    })

    // 获取系统
    ipcRenderer.invoke('fetch-system-name').then((systemName) => {
      setSystem(systemName)
    })

    // dropdown 点击外部关闭
    const handleClickOutside = (event) => {
      if (scanningdropdownRef.current && !scanningdropdownRef.current.contains(event.target)) {
        setShowScanningDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // 修改查询间隔时间后
  useDebounceEffect(
    () => {
      if (timeRef.current) clearInterval(timeRef.current)
      timeRef.current = setInterval(updateAllInfo, timeInterval * 1000)

      return () => {
        isRunRef.current = false
        if (timeRef.current) clearInterval(timeRef.current)
        timeRef.current = null
      }
    },
    [timeInterval],
    { wait: 300 },
  )

  const updateAllInfo = useMemoizedFn(() => {
    if (isRunRef.current) return
    isRunRef.current = true
    Promise.allSettled([updatePcap()])
      .then(() => {
        isRunRef.current = false
      })
      .catch(() => {})
  })

  // 打开页面
  const onMenu = (info: RouteToPageProps) => {
    if (!info.route) return
    emiter.emit('menuOpenPage', JSON.stringify(info))
  }
  // 打开页面 - 带参数
  const onMenuParams = (info: { route: YakitRoute; params: any }) => {
    if (!info.route) return
    emiter.emit('openPage', JSON.stringify(info))
  }

  // 获取网卡操作权限
  const updatePcap = useMemoizedFn(() => {
    return new Promise((resolve, reject) => {
      ipcRenderer
        .invoke('IsPrivilegedForNetRaw', {})
        .then((res) => {
          setPcap(res)
          resolve('pcap')
        })
        .catch((e) => reject(`error-pcap ${e}`))
    })
  })

  // 开启PCAP权限
  const openPcapPower = useMemoizedFn(() => {
    setPcapHintLoading(true)
    ipcRenderer
      .invoke(`PromotePermissionForUserPcap`, {})
      .then(() => {
        setPcapResult(true)
      })
      .catch((e) => {
        yakitNotify('error', t('Home.pcapPermissionFailed') + `${e}`)
      })
      .finally(() => setPcapHintLoading(false))
  })

  // 开始扫描
  const handleOpenScanning = useMemoizedFn(() => {
    if (scanningCheck === 'specialVulnerabilityDetection') {
      onMenu({ route: YakitRoute.PoC })
    } else if (scanningCheck === 'customDetection') {
      onMenu({ route: YakitRoute.BatchExecutorPage })
    }
    setRemoteValue(RemoteGV.HomeStartScanning, scanningCheck)
  })

  // 计算各个块的高度
  const informationGatheringRef = useRef<HTMLDivElement>(null)
  const scanningRef = useRef<HTMLDivElement>(null)
  const scanningSize = useSize(scanningRef)
  const pluginHubRef = useRef<HTMLDivElement>(null)
  const smallToolsRef = useRef<HTMLDivElement>(null)
  const [watchWidth, setWatchWidth] = useState<number>(0)
  const adjustHeight = (container, wRadio: number, hRadio: number, minHeight: number, maxHeight: number) => {
    if (!container) return
    const width = container.getBoundingClientRect().width
    const height = (width * hRadio) / wRadio
    if (height > maxHeight) {
      container.style.height = maxHeight + 'px'
      return
    }
    if (height < minHeight) {
      container.style.height = minHeight + 'px'
      return
    }
    container.style.height = height + 'px'
  }
  const calcInformationGatheringAndScanningMinHeight = () => {
    const screenWidth = document.body.getBoundingClientRect().width
    if (screenWidth <= 1220) return 350
    if (screenWidth <= 1920) return 400
    return 500
  }
  const calcInformationGatheringAndScanningMaxHeight = () => {
    const screenWidth = document.body.getBoundingClientRect().width
    if (screenWidth <= 1220) return 450
    if (screenWidth <= 1920) return 600
    return 650
  }
  const calcSignlejumpAndSmallToolsMinHeight = () => {
    const screenWidth = document.body.getBoundingClientRect().width
    if (screenWidth <= 1220) return 260
    if (screenWidth <= 1920) return 275
    return 300
  }
  const calcSignlejumpAndSmallToolsMaxHeight = () => {
    const screenWidth = document.body.getBoundingClientRect().width
    if (screenWidth <= 1220) return 275
    if (screenWidth <= 1920) return 290
    return 450
  }
  const resizeAdjustHeight = useThrottleFn(
    () => {
      if (isScanMode) {
        adjustHeight(
          informationGatheringRef.current,
          16,
          9,
          calcInformationGatheringAndScanningMinHeight(),
          calcInformationGatheringAndScanningMaxHeight(),
        )
        adjustHeight(
          scanningRef.current,
          16,
          9,
          calcInformationGatheringAndScanningMinHeight(),
          calcInformationGatheringAndScanningMaxHeight(),
        )
        adjustHeight(
          pluginHubRef.current,
          16,
          9,
          calcSignlejumpAndSmallToolsMinHeight(),
          calcSignlejumpAndSmallToolsMaxHeight(),
        )
        adjustHeight(
          smallToolsRef.current,
          16,
          9,
          calcSignlejumpAndSmallToolsMinHeight(),
          calcSignlejumpAndSmallToolsMaxHeight(),
        )
      }
    },
    { wait: 100 },
  ).run
  useEffect(() => {
    resizeAdjustHeight()
  }, [watchWidth, softMode])

  return (
    <div className={styles['home-page-wrapper']} ref={homeRef}>
      <div className={styles['home-page-wrapper-left']}>
        <ReactResizeDetector
          onResize={(w, h) => {
            if (!w || !h) {
              return
            }
            setWatchWidth(w)
          }}
          handleHeight={true}
        />
        <div className={styles['left-row-wrapper']}>
          {isScanMode ? (
            <>
              <div
                ref={informationGatheringRef}
                className={classNames(styles['informationGathering-card'], styles['home-card'])}
              >
                <div className={styles['home-card-header']}>
                  <div className={styles['home-card-header-title']}>
                    <PublicInformationGatheringIcon className={styles['title-icon']} />
                    <span className={styles['title-text']}>{t('Home.informationGathering')}</span>
                  </div>
                  <div className={styles['home-card-header-desc']}>{t('Home.assetReconDescription')}</div>
                </div>
                <div className={styles['informationGathering-items-wrapper']}>
                  <div
                    className={styles['informationGathering-item']}
                    onClick={() => onMenu({ route: YakitRoute.Mod_ScanPort })}
                  >
                    <PublicScanPortIcon className={styles['item-icon']} />
                    <span className={styles['item-text']} title={t('YakitRoute.portScan')}>
                      {t('YakitRoute.portScan')}
                    </span>
                  </div>
                  <div
                    className={styles['informationGathering-item']}
                    onClick={() =>
                      onMenu({
                        route: YakitRoute.Plugin_OP,
                        pluginId: pluginToId[ResidentPluginName.DirectoryScanning],
                        pluginName: ResidentPluginName.DirectoryScanning,
                      })
                    }
                  >
                    <PublicDirectoryScanningIcon className={styles['item-icon']} />
                    <span className={styles['item-text']} title={t('YakitRoute.directoryScan')}>
                      {t('YakitRoute.directoryScan')}
                    </span>
                  </div>
                </div>
              </div>
              <div ref={scanningRef} className={classNames(styles['vulnerability-scanning-card'], styles['home-card'])}>
                <div className={styles['home-card-header']}>
                  <div className={styles['home-card-header-title']}>
                    <PublicPocIcon className={styles['title-icon']} />
                    <span className={styles['title-text']}>{t('YakitRoute.vulnScan')}</span>
                  </div>
                  <div className={styles['home-card-header-desc']}>{t('Home.vulnBatchScan')}</div>
                </div>
                <div className={styles['home-card-operation-btn-wrapper']}>
                  <div className={styles['operation-btn-wrapper']} ref={scanningdropdownRef}>
                    <div
                      className={styles['operation-btn-left']}
                      style={{
                        borderRadius: '40px 0 0 40px',
                        width: scanningSize?.width
                          ? scanningSize?.width > 600
                            ? (scanningSize?.width - 200) / 3
                            : undefined
                          : undefined,
                      }}
                      onClick={handleOpenScanning}
                    >
                      <SolidPlayIcon className={styles['open-icon']} />
                      {t('YakitButton.startScan')}
                    </div>
                    <div
                      className={styles['operation-btn-right']}
                      style={{
                        borderRadius: '0 40px 40px 0',
                      }}
                      onClick={() => setShowScanningDropdown(!showScanningDropdown)}
                    >
                      <OutlineChevronupIcon
                        className={classNames(styles['title-icon'], {
                          [styles['rotate-180']]: !showScanningDropdown,
                        })}
                      />
                    </div>
                    <div
                      className={styles['operation-dropdown-wrapper']}
                      style={{ display: showScanningDropdown ? 'block' : 'none' }}
                    >
                      {[
                        {
                          label: t('YakitRoute.vulnTargetedScan'),
                          key: 'specialVulnerabilityDetection',
                        },
                        { label: t('Home.vulnCustomScan'), key: 'customDetection' },
                      ].map((item) => (
                        <div
                          className={classNames(styles['operation-dropdown-list-item'], {
                            [styles['active']]: scanningCheck === item.key,
                          })}
                          onClick={() => {
                            setScanningCheck(item.key)
                            setShowScanningDropdown(!showScanningDropdown)
                          }}
                          key={item.key}
                        >
                          <span>{item.label}</span>
                          {scanningCheck === item.key && <SolidCheckIcon className={styles['check-icon']} />}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                {!pcap.IsPrivileged && system !== 'Windows_NT' && (
                  <div className={styles['home-card-config-detection']}>
                    <div className={styles['config-detection-left']}>
                      <SolidExclamationIcon className={styles['exclamation-icon']} />
                      {t('Home.netcardPermissionNotFixed')}
                    </div>
                    <YakitButton
                      type="text"
                      className={styles['config-detection-btn']}
                      onClick={() => {
                        if (pcapHintShow) return
                        setPcapHintShow(true)
                      }}
                    >
                      {t('YakitButton.actionFixNow')}
                    </YakitButton>
                  </div>
                )}
                <div className={styles['security-tools']}>
                  <div className={styles['security-tools-item']} onClick={() => onMenu({ route: YakitRoute.PoC })}>
                    <PublicPocIcon className={styles['title-icon']} />
                    <span className={styles['tools-text']} title={t('YakitRoute.vulnTargetedScan')}>
                      {t('YakitRoute.vulnTargetedScan')}
                    </span>
                  </div>
                  <div
                    className={styles['security-tools-item']}
                    onClick={() =>
                      onMenu({
                        route: YakitRoute.BatchExecutorPage,
                      })
                    }
                  >
                    <PublicBatchExecutorIcon className={styles['tools-icon']} />
                    <span className={styles['tools-text']} title={t('Home.vulnCustomScan')}>
                      {t('Home.vulnCustomScan')}
                    </span>
                  </div>
                  <div
                    className={styles['security-tools-item']}
                    onClick={() => onMenu({ route: YakitRoute.Mod_Brute })}
                  >
                    <PublicBruteIcon className={styles['tools-icon']} />
                    <span className={styles['tools-text']} title={t('YakitRoute.weakPasswordCheck')}>
                      {t('YakitRoute.weakPasswordCheck')}
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className={styles['tools-grid-wrapper']}>
              {toolsList.map((item) => (
                <div className={styles['tools-grid-item']} key={item.label} onClick={item.onClick} title={item.desc}>
                  <div className={styles['tools-grid-item-cont']}>
                    <div className={styles['tools-grid-item-icon']} style={item.iconStyle}>
                      {item.icon}
                    </div>
                    <div className={styles['tools-grid-item-cont-right']}>
                      <div className={styles['tools-grid-item-title']}>{item.label}</div>
                      <div className={styles['tools-grid-item-desc']}>{item.desc}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        {isScanMode && (
          <div className={styles['left-row-wrapper']}>
            <>
              <div ref={pluginHubRef} className={classNames(styles['pluginHub-card'], styles['home-card'])}>
                <div className={styles['home-card-header']}>
                  <div className={styles['home-card-header-title']}>
                    <PublicPluginStoreIcon className={styles['title-icon']} />
                    <span className={styles['title-text']}>{t('YakitRoute.pluginHub')}</span>
                  </div>
                  <div className={styles['home-card-header-desc']}>{t('Home.pluginCoverageDescription')}</div>
                </div>
                <div className={styles['pluginHub-tabs']}>
                  {!isEnpriTrace() && (
                    <div
                      className={styles['pluginHub-tabs-item']}
                      onClick={() =>
                        onMenuParams({
                          route: YakitRoute.Plugin_Hub,
                          params: { tabActive: 'online' } as PluginHubPageInfoProps,
                        })
                      }
                    >
                      <PublicPluginStoreIcon className={styles['tabs-icon']} />
                      <span className={styles['tabs-text']} title={t('Home.pluginStore')}>
                        {t('Home.pluginStore')}
                      </span>
                    </div>
                  )}
                  <div
                    className={styles['pluginHub-tabs-item']}
                    onClick={() =>
                      onMenuParams({
                        route: YakitRoute.Plugin_Hub,
                        params: { tabActive: 'own' } as PluginHubPageInfoProps,
                      })
                    }
                  >
                    <PublicPluginMineIcon className={styles['tabs-icon']} />
                    <span className={styles['tabs-text']} title={t('Home.pluginsMine')}>
                      {t('Home.pluginsMine')}
                    </span>
                  </div>
                  <div
                    className={styles['pluginHub-tabs-item']}
                    onClick={() =>
                      onMenuParams({
                        route: YakitRoute.Plugin_Hub,
                        params: { tabActive: 'local' } as PluginHubPageInfoProps,
                      })
                    }
                  >
                    <PublicPluginLocalIcon className={styles['tabs-icon']} />
                    <span className={styles['tabs-text']} title={t('Home.pluginLocal')}>
                      {t('Home.pluginLocal')}
                    </span>
                  </div>
                </div>
              </div>

              <div ref={smallToolsRef} className={styles['small-tools-wrapper']}>
                <div className={styles['small-tools-item']} onClick={() => onMenu({ route: YakitRoute.Codec })}>
                  <div className={styles['small-tools-item-cont']}>
                    <PublicCodecIcon className={styles['small-tools-item-icon']} />
                    <div className={styles['small-tools-item-cont-right']}>
                      <div className={styles['small-tools-cont-title']}>{t('YakitRoute.Codec')}</div>
                      <div className={styles['small-tools-cont-desc']}>{t('Home.codecDesc')}</div>
                    </div>
                  </div>
                </div>
                <div
                  className={styles['small-tools-item']}
                  onClick={() => onMenu({ route: YakitRoute.PayloadManager })}
                >
                  <div className={styles['small-tools-item-cont']}>
                    <PublicPayloadManagerIcon className={styles['small-tools-item-icon']} />
                    <div className={styles['small-tools-item-cont-right']}>
                      <div className={styles['small-tools-cont-title']}>{t('YakitRoute.Payload')}</div>
                      <div className={styles['small-tools-cont-desc']}>{t('Home.payloadDesc')}</div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          </div>
        )}
        <YakitHint
          visible={pcapHintShow}
          heardIcon={pcapResult ? <AllShieldCheckIcon /> : undefined}
          title={pcapResult ? t('Home.netcardAccessGranted') : t('Home.netcardNoAccess')}
          width={600}
          content={
            pcapResult ? (
              <>{t('Home.netcardRepairWaiting')}</>
            ) : (
              <>
                {t('Home.linuxMacosPermission')}{' '}
                <YakitTag enableCopy={true} color="yellow" copyText={`chmod +rw /dev/bpf*`}></YakitTag>
                {t('Home.or')}{' '}
                <YakitTag enableCopy={true} color="purple" copyText={`sudo chmod +rw /dev/bpf*`}></YakitTag>
                {t('Home.rwPermissionAvailable')}
              </>
            )
          }
          okButtonText={t('Home.pcapEnablePermission')}
          cancelButtonText={pcapResult ? t('YakitButton.ok') : t('YakitButton.remindMeLater')}
          okButtonProps={{
            loading: pcapHintLoading,
            style: pcapResult ? { display: 'none' } : undefined,
          }}
          cancelButtonProps={{ loading: !pcapResult && pcapHintLoading }}
          onOk={openPcapPower}
          onCancel={() => {
            setPcapResult(false)
            setPcapHintShow(false)
          }}
          footerExtra={
            pcapResult ? undefined : (
              <Tooltip title={`${pcap.AdviceVerbose}: ${pcap.Advice}`}>
                <YakitButton className={styles['btn-style']} type="text" size="max">
                  {t('YakitButton.manualFix')}
                </YakitButton>
              </Tooltip>
            )
          }
        ></YakitHint>
      </div>
    </div>
  )
}

export default Home
