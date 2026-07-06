/**
 * aux 窗专用：从文档 CSS 变量里抽取终端配色，组装 xterm theme。
 * 不引入 monaco 相关模块，保持轻量。
 */

const TOKEN_PREFIXES = ['--Colors-Use-', '--yakit-colors-'] as const

/** 判定一个 CSS 自定义属性名是否属于我们关心的命名空间 */
const isThemeToken = (prop: string): boolean => TOKEN_PREFIXES.some((prefix) => prop.startsWith(prefix))

/**
 * 单一聚合函数：遍历文档样式表 + 元素内联样式，把所有命中前缀的 CSS 变量
 * 收成 `{ varName: resolvedValue }` 字典。同一变量只取首次解析值。
 */
function readThemeVars(): Record<string, string> {
  const resolved = getComputedStyle(document.documentElement)
  const collected: Record<string, string> = {}
  const seen = new Set<string>()

  const ingest = (prop: string) => {
    if (seen.has(prop) || !isThemeToken(prop)) return
    const value = resolved.getPropertyValue(prop).trim()
    if (!value) return
    seen.add(prop)
    collected[prop] = value
  }

  for (let s = 0; s < document.styleSheets.length; s++) {
    let rules: CSSRuleList
    try {
      rules = document.styleSheets[s].cssRules
    } catch {
      continue
    }
    for (let r = 0; r < rules.length; r++) {
      const rule = rules[r]
      if (rule.type !== CSSRule.STYLE_RULE) continue
      const declarations = (rule as CSSStyleRule).style
      for (let i = 0; i < declarations.length; i++) ingest(declarations[i])
    }
  }

  const inline = document.documentElement.style
  for (let i = 0; i < inline.length; i++) ingest(inline[i])

  return collected
}

/** 组装 16 色扩展 ANSI 调色板（顺序即 xterm extendedAnsi 语义） */
function buildAnsiPalette(v: Record<string, string>): string[] {
  return [
    v['--Colors-Use-Neutral-Bg'],
    v['--Colors-Use-Neutral-Bg-Hover'],
    v['--Colors-Use-Neutral-Disable'],
    v['--Colors-Use-Neutral-Border'],
    v['--yakit-colors-Blue-80'],
    v['--yakit-colors-Green-80'],
    v['--yakit-colors-Orange-80'],
    v['--yakit-colors-Error-80'],
    v['--yakit-colors-Blue-100'],
    v['--yakit-colors-Magenta-80'],
    v['--yakit-colors-Lake-blue-80'],
    v['--yakit-colors-Green-100'],
    v['--yakit-colors-Orange-100'],
    v['--yakit-colors-Error-100'],
    v['--Colors-Use-Blue-Primary'],
    v['--Colors-Use-Main-Primary'],
  ]
}

export const getTerminalTheme = () => {
  const v = readThemeVars()
  const title = v['--Colors-Use-Neutral-Text-1-Title']
  const bg = v['--Colors-Use-Neutral-Bg']
  return {
    background: bg,
    foreground: title,
    cursor: v['--Colors-Use-Main-Primary'],
    cursorAccent: bg,
    selectionBackground: v['--Colors-Use-Main-Focus'],
    selectionForeground: title,
    selectionInactiveBackground: v['--Colors-Use-Neutral-Disable'],
    black: bg,
    red: v['--Colors-Use-Error-Primary'],
    green: v['--yakit-colors-Green-80'],
    yellow: v['--yakit-colors-Orange-80'],
    blue: v['--yakit-colors-Blue-80'],
    magenta: v['--yakit-colors-Magenta-80'],
    cyan: v['--yakit-colors-Lake-blue-80'],
    white: title,
    brightBlack: v['--Colors-Use-Neutral-Disable'],
    brightRed: v['--yakit-colors-Error-80'],
    brightGreen: v['--yakit-colors-Green-100'],
    brightYellow: v['--yakit-colors-Orange-100'],
    brightBlue: v['--yakit-colors-Blue-100'],
    brightMagenta: v['--yakit-colors-Magenta-100'],
    brightCyan: v['--yakit-colors-Lake-blue-100'],
    brightWhite: title,
    extendedAnsi: buildAnsiPalette(v),
  }
}
