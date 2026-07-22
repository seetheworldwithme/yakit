import React, { useMemo } from 'react'
import { SlidersOutlined, KeyOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { YakitRoute } from '@/enums/yakitRoute'
import { WorkbenchDomain, moduleIcon } from './domainMap'
import { DesktopComputerSvgIcon } from '@/assets/newIcon'
import emiter from '@/utils/eventBus/eventBus'
import { useStore } from '@/store'
import { useLayoutRailStore } from '@/store/layoutRail'
import { useI18nNamespaces } from '@/i18n/useI18nNamespaces'
import { YakitPopover } from '@/components/yakitUI/YakitPopover/YakitPopover'
import { YakitMenu, YakitMenuItemType, YakitMenuItemProps } from '@/components/yakitUI/YakitMenu/YakitMenu'
import { YakitDropdownMenu } from '@/components/yakitUI/YakitDropdownMenu/YakitDropdownMenu'
import cloneDeep from 'lodash/cloneDeep'
import './DomainRail.scss'

export interface DomainRailProps {
  domain: WorkbenchDomain
  onOpenRoute: (route: YakitRoute) => void
}

export const DomainRail: React.FC<DomainRailProps> = React.memo((props) => {
  const { domain, onOpenRoute } = props
  const { t } = useI18nNamespaces(['layout'])
  const isLogin = useStore((s) => s.userInfo.isLogin)
  const userMenuItems = useLayoutRailStore((s) => s.userMenuItems)
  const onUserMenuClick = useLayoutRailStore((s) => s.onUserMenuClick)
  const openLogin = useLayoutRailStore((s) => s.openLogin)
  const settingMenu = useLayoutRailStore((s) => s.settingMenu)
  const openGlobalState = useLayoutRailStore((s) => s.openGlobalState)

  // 用户菜单 label 为 i18n key，这里翻译成文案（与 FuncDomain 头部下拉保持一致）
  const userMenuData = useMemo(
    () =>
      userMenuItems.map((item) => {
        const obj = cloneDeep(item) as YakitMenuItemProps
        // @ts-ignore
        if (obj?.label && typeof obj.label === 'string') {
          // @ts-ignore
          obj.label = t(obj.label)
        }
        return obj
      }),
    [userMenuItems, t],
  )

  return (
    <nav className="wb-rail">
      <div className="wb-rail-head">
        <span className="wb-rail-head-icon">{domain.icon}</span>
        <span className="wb-rail-head-label">{domain.label}</span>
      </div>
      <ul className="wb-rail-list">
        {domain.modules.map((m) => (
          <li key={m.route} className="wb-rail-item" onClick={() => onOpenRoute(m.route)}>
            <span className="wb-rail-item-icon">{moduleIcon(m.route)}</span>
            <span className="wb-rail-item-label">{m.label}</span>
          </li>
        ))}
      </ul>
      <div className="wb-rail-footer">
        <div className="wb-rail-item" onClick={() => emiter.emit('onOpenProjectManage')}>
          <span className="wb-rail-item-icon">
            <DesktopComputerSvgIcon />
          </span>
          <span className="wb-rail-item-label">项目管理</span>
        </div>

        {/* 设置：复用 FuncDomain 的设置浮层，选中动作经事件总线 onUIOpSettingMenuSelect 处理 */}
        <YakitPopover
          overlayClassName="wb-rail-popover"
          placement={'right'}
          trigger="click"
          content={
            <YakitMenu
              data={settingMenu as YakitMenuItemProps[]}
              onClick={({ key }) => emiter.emit('onUIOpSettingMenuSelect', key)}
            />
          }
        >
          <div className="wb-rail-item">
            <span className="wb-rail-item-icon">
              <SlidersOutlined />
            </span>
            <span className="wb-rail-item-label">设置</span>
          </div>
        </YakitPopover>

        {/* 用户：已登录弹出用户下拉菜单（菜单数据/动作来自 FuncDomain 经 store 桥接）；未登录开登录弹窗 */}
        {isLogin ? (
          <YakitDropdownMenu
            menu={{
              data: userMenuData as YakitMenuItemType[],
              onClick: (e) => onUserMenuClick(e.key),
            }}
            dropdown={{
              placement: 'topRight',
              trigger: ['click'],
            }}
          >
            <div className="wb-rail-item">
              <span className="wb-rail-item-icon">
                <KeyOutlined />
              </span>
              <span className="wb-rail-item-label">用户</span>
            </div>
          </YakitDropdownMenu>
        ) : (
          <div className="wb-rail-item" onClick={() => openLogin()}>
            <span className="wb-rail-item-icon">
              <KeyOutlined />
            </span>
            <span className="wb-rail-item-label">登录</span>
          </div>
        )}

        {/* 系统检测：复用顶部 GlobalState 的原有检测与弹窗逻辑 */}
        <div
          className="wb-rail-item wb-rail-system-check"
          onClick={(event) => {
            const anchorRect = event.currentTarget.getBoundingClientRect()
            setTimeout(() => openGlobalState(anchorRect), 0)
          }}
        >
          <span className="wb-rail-item-icon">
            <SafetyCertificateOutlined />
          </span>
          <span className="wb-rail-item-label">系统检测</span>
        </div>
      </div>
    </nav>
  )
})
