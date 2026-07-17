import { applyThemeColors, generateColors } from '@yakit-libs/color'
import type { ColorHex } from '@yakit-libs/color'

type Theme = 'light' | 'dark'

const VISUAL_THEME_OVERRIDES: Record<Theme, Record<string, string>> = {
  light: {
    '--Colors-Use-Base-Background': '#F4F8FC',
    '--Colors-Use-Basic-Background': '#F4F8FC',
    '--Colors-Use-Neutral-Bg': '#FFFFFF',
    '--Colors-Use-Neutral-Bg-Hover': '#EAF4FB',
    '--Colors-Use-Neutral-Bg-Pressed': '#DCECF7',
    '--Colors-Use-Neutral-Border': '#C8DCEB',
    '--Colors-Use-Neutral-Disable': '#9FB3C8',
    '--Colors-Use-Neutral-Text-1-Title': '#102A43',
    '--Colors-Use-Neutral-Text-2-Primary': '#334E68',
    '--Colors-Use-Neutral-Text-2-Subtitle': '#486581',
    '--Colors-Use-Neutral-Text-2-Body': '#334E68',
    '--Colors-Use-Neutral-Text-3-Secondary': '#627D98',
    '--Colors-Use-Neutral-Text-4-Help-text': '#829AB1',
    '--Colors-Use-Basic-Shadow': 'rgba(16,42,67,0.16)',
    '--Colors-Use-Basic-Modal-bg': 'rgba(7,21,34,0.32)',
  },
  dark: {
    '--Colors-Use-Base-Background': '#0A1929',
    '--Colors-Use-Basic-Background': '#0A1929',
    '--Colors-Use-Neutral-Bg': '#0F1E33',
    '--Colors-Use-Neutral-Bg-Hover': '#142844',
    '--Colors-Use-Neutral-Bg-Pressed': '#16304F',
    '--Colors-Use-Neutral-Border': '#1E3350',
    '--Colors-Use-Neutral-Disable': '#6F879D',
    '--Colors-Use-Neutral-Text-1-Title': '#E6F4FA',
    '--Colors-Use-Neutral-Text-2-Primary': '#B8CDE2',
    '--Colors-Use-Neutral-Text-2-Subtitle': '#B8CDE2',
    '--Colors-Use-Neutral-Text-2-Body': '#B8CDE2',
    '--Colors-Use-Neutral-Text-3-Secondary': '#8FA8BF',
    '--Colors-Use-Neutral-Text-4-Help-text': '#5A7287',
    '--Colors-Use-Basic-Shadow': 'rgba(2,8,23,0.56)',
    '--Colors-Use-Basic-Modal-bg': 'rgba(2,8,23,0.72)',
  },
}

export function applyYakitThemeColors(theme: Theme, mainColorOverride?: string) {
  const colors = {
    ...generateColors(theme, mainColorOverride as ColorHex | undefined),
    ...VISUAL_THEME_OVERRIDES[theme],
  }
  applyThemeColors(theme, colors)
}
