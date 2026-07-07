import React from 'react'
import {
  AppstoreOutlined,
  DashboardOutlined,
  RadarChartOutlined,
  ScanOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { YakitRoute } from '@/enums/yakitRoute'
import { PrivateAllMenus } from '@/routes/newRoute'

export type DomainKey = 'recon' | 'strike' | 'detect' | 'extend' | 'govern'

export interface WorkbenchModule {
  route: YakitRoute
  label: string
}

export interface WorkbenchDomain {
  key: DomainKey
  label: string
  icon: React.ReactNode
  modules: WorkbenchModule[]
}

// 复用 PrivateAllMenus 里每个页面已配好的图标
export const moduleIcon = (route: YakitRoute): React.ReactNode => PrivateAllMenus[route]?.icon

// 5 域能力重组：把原版"扁平顶级 tab"切成攻击者工作流的五个域
export const WORKBENCH_DOMAINS: WorkbenchDomain[] = [
  {
    key: 'recon',
    label: '侦收',
    icon: <RadarChartOutlined />,
    modules: [
      { route: YakitRoute.DB_HTTPHistory, label: '流量档案' },
      { route: YakitRoute.Codec, label: '编解码台' },
      { route: YakitRoute.DataCompare, label: '差异比对' },
    ],
  },
  {
    key: 'strike',
    label: '进攻',
    icon: <ThunderboltOutlined />,
    modules: [
      { route: YakitRoute.MITMHacker, label: '实时劫持' },
      { route: YakitRoute.HTTPFuzzer, label: '报文构造台' },
      { route: YakitRoute.Mod_Brute, label: '凭证爆破' },
      { route: YakitRoute.BatchExecutorPage, label: '批量投递' },
      { route: YakitRoute.DNSLog, label: '反连接收' },
    ],
  },
  {
    key: 'detect',
    label: '检测',
    icon: <ScanOutlined />,
    modules: [
      { route: YakitRoute.Mod_ScanPort, label: '资产测绘' },
      { route: YakitRoute.PoC, label: '漏洞检测' },
      { route: YakitRoute.DB_Risk, label: '风险台账' },
      { route: YakitRoute.DB_Report, label: '报告中心' },
    ],
  },
  {
    key: 'extend',
    label: '扩展',
    icon: <AppstoreOutlined />,
    modules: [
      { route: YakitRoute.YakScript, label: '脚本引擎' },
      { route: YakitRoute.Plugin_Hub, label: '插件市场' },
      { route: YakitRoute.PayloadManager, label: '字典库' },
    ],
  },
  {
    key: 'govern',
    label: '治理',
    icon: <DashboardOutlined />,
    modules: [{ route: YakitRoute.NewHome, label: '态势总览' }],
  },
]
