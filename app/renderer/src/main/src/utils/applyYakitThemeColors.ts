import { applyThemeColors, generateColors } from '@yakit-libs/color'
import type { ColorHex } from '@yakit-libs/color'
import type { Theme } from '@/hook/useTheme'

export function applyYakitThemeColors(theme: Theme, mainColorOverride?: string) {
  applyThemeColors(theme, generateColors(theme, mainColorOverride as ColorHex | undefined))
  // 深空青蓝：主色 Main-* 已由 generateColors 按 GetMainColor 生成；此处只在 dark 主题覆写中性/底色 token
  if (theme === 'dark') applyDeepCyanDarkOverride()
}

// 深空青蓝中性色覆写（仅 dark）：把生成器的暗灰底换成 #0A1929 深蓝底
const DEEP_CYAN_DARK_TOKENS: Record<string, string> = {
  '--Colors-Use-Basic-Background': '#0A1929',
  '--Colors-Use-Neutral-Bg': '#0F1E33',
  '--Colors-Use-Neutral-Bg-Hover': '#142844',
  '--Colors-Use-Neutral-Bg-Pressed': '#16304F',
  '--Colors-Use-Neutral-Border': '#1E3350',
  '--Colors-Use-Neutral-Text-1-Title': '#E6F4FA',
  '--Colors-Use-Neutral-Text-2-Subtitle': '#B8CDE2',
  '--Colors-Use-Neutral-Text-3-Secondary': '#8FA8BF',
}

function applyDeepCyanDarkOverride() {
  const root = document.documentElement
  Object.entries(DEEP_CYAN_DARK_TOKENS).forEach(([token, value]) => root.style.setProperty(token, value))
}
