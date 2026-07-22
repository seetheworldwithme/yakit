import { createWithEqualityFn } from 'zustand/traditional'
import { YakitMenuItemType } from '@/components/yakitUI/YakitMenu/YakitMenu'

/**
 * 侧边栏「设置 / 用户」入口所需的菜单数据与动作处理。
 *
 * 背景：设置浮层与用户下拉菜单的状态/弹窗都挂在 FuncDomain（SentinelShell 头部）上，
 * 而新的入口要渲染在 DomainRail（WorkbenchShell 侧边栏底部），两者分属不同子树、不共享 state。
 * 这里作为桥接：FuncDomain 把现成的菜单数据和点击处理注册进来，DomainRail 读取后自行渲染触发点，
 * 浮层/弹窗逻辑仍全部留在 FuncDomain，避免把重状态下钻到多变体共享文件。
 */
interface LayoutRailStoreProps {
  /** 用户下拉菜单数据（已按角色构建，label 仍为 i18n key，由消费侧 t() 翻译） */
  userMenuItems: YakitMenuItemType[]
  /** 用户菜单项点击处理（复用 FuncDomain 内联逻辑） */
  onUserMenuClick: (key: string) => void
  /** 未登录时打开登录弹窗 */
  openLogin: () => void
  /** 设置浮层菜单数据 */
  settingMenu: YakitMenuItemType[]
  /** 打开系统检测浮层（由 GlobalState 注册，供侧边栏入口复用） */
  openGlobalState: () => void
  /** 注册用户菜单数据与动作（由 FuncDomain 调用） */
  setUserMenuBridge: (payload: {
    userMenuItems: YakitMenuItemType[]
    onUserMenuClick: (key: string) => void
    openLogin: () => void
  }) => void
  /** 注册设置浮层菜单数据（由 FuncDomain 调用） */
  setSettingMenu: (settingMenu: YakitMenuItemType[]) => void
  /** 注册系统检测浮层打开动作（由 GlobalState 调用） */
  setGlobalStateBridge: (openGlobalState: () => void) => void
}

const noop = () => {}

export const useLayoutRailStore = createWithEqualityFn<LayoutRailStoreProps>(
  (set) => ({
    userMenuItems: [],
    onUserMenuClick: noop,
    openLogin: noop,
    settingMenu: [],
    openGlobalState: noop,
    setUserMenuBridge: (payload) => {
      set({
        userMenuItems: payload.userMenuItems,
        onUserMenuClick: payload.onUserMenuClick,
        openLogin: payload.openLogin,
      })
    },
    setSettingMenu: (settingMenu) => {
      set({ settingMenu })
    },
    setGlobalStateBridge: (openGlobalState) => {
      set({ openGlobalState })
    },
  }),
  Object.is,
)
