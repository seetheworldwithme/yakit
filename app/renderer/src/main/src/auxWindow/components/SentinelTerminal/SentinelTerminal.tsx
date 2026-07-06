import { ForwardedRef, forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import 'xterm/css/xterm.css'
import { FitAddon, type ITerminalOptions, Terminal } from '@xterm/xterm'
import { getTerminalTheme } from './terminalTheme'
import styles from './SentinelTerminal.module.scss'

/**
 * 对外暴露的命令式句柄：父组件通过 ref 拿到底层 Terminal 实例，
 * 用于写入数据、清屏、取选区等。
 */
export interface SentinelTerminalRef {
  terminal: Terminal
}

type KeyHandler = (event: KeyboardEvent) => boolean

export interface SentinelTerminalProps {
  /** 透传给 xterm Terminal 的选项，最终与默认项合并 */
  terminalOptions?: ITerminalOptions
  /** 自定义按键拦截，返回 false 可阻止默认行为 */
  onKeyEvent?: KeyHandler
}

const BASE_TERMINAL_OPTIONS: ITerminalOptions = {
  // 等宽字体族，保证终端列宽对齐
  fontFamily: `'Consolas', 'Lucida Console', 'Courier New', monospace`,
  convertEol: true,
}

/** 监听容器尺寸变化，自动 refit 列数/行数；返回清理函数。 */
function bindAutoFit(target: HTMLDivElement, fit: FitAddon): () => void {
  const observer = new ResizeObserver(() => fit.fit())
  observer.observe(target)
  return () => observer.disconnect()
}

const SentinelTerminal = forwardRef<SentinelTerminalRef, SentinelTerminalProps>(function SentinelTerminal(
  { terminalOptions = {}, onKeyEvent }: SentinelTerminalProps,
  ref: ForwardedRef<SentinelTerminalRef>,
) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const instanceRef = useRef<Terminal | null>(null)

  // 对外只暴露 terminal 句柄；通过 getter 读最新实例，避免 stale 闭包
  useImperativeHandle(
    ref,
    () => ({
      get terminal(): Terminal {
        return instanceRef.current as Terminal
      },
    }),
    [],
  )

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const terminal = new Terminal({ ...BASE_TERMINAL_OPTIONS, ...terminalOptions, theme: getTerminalTheme() })
    const fit = new FitAddon()
    terminal.loadAddon(fit)
    if (onKeyEvent) terminal.attachCustomKeyEventHandler(onKeyEvent)
    terminal.open(host)
    fit.fit()
    instanceRef.current = terminal

    const release = bindAutoFit(host, fit)
    return () => {
      release()
      terminal.dispose()
      fit.dispose()
      instanceRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div className={styles['sentinel-terminal']} ref={hostRef} />
})

export default SentinelTerminal
