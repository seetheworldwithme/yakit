import ReactDOM from 'react-dom'
import reportWebVitals from './reportWebVitals'
/** 该样式必须放在APP组件的前面，因为里面有antd样式，放后面会把APP组件内的样式覆盖 */
import './index.css'
import SentinelWorkspace from './SentinelWorkspace'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { DndProvider } from 'react-dnd'
// import {createRoot} from "react-dom/client"
import './yakitUI.scss'
import './theme/yakit.scss'
import './yakitLib.scss'
import './assets/global.scss'
import './theme/scrollbar.scss'
import { Suspense, useEffect, useState, type FC, type ReactNode } from 'react'
import SentinelChildWindow from './SentinelChildWindow'
import MarkdownPdfPrintPage from './pages/irifyAiCodeAudit/MarkdownPdfPrint/MarkdownPdfPrintPage'
import { getLocalValue } from './utils/kv'
import { GetMainColor, getRemoteI18nGV } from './utils/envfile'
import i18n from '@/i18n/i18n'
import { useTheme } from './hook/useTheme'
import { applyYakitThemeColors } from './utils/applyYakitThemeColors'
import { registerAppSyncHandlers } from '@/auxWindow/utils/messaging'
import { setupConcurrentStreamMainBridge } from '@/pages/ai-agent/components/ConcurrentStreamCard/concurrentStream/concurrentStreamMainBridge'
import { debugToPrintLogs } from './utils/logCollection'

const MONACO_WORKER_BASE = 'static/js/monaco'

window.MonacoEnvironment = {
  getWorkerUrl: function (moduleId, label) {
    switch (label) {
      case 'json':
        return `${MONACO_WORKER_BASE}/json.worker.js`
      case 'yaml':
        return `${MONACO_WORKER_BASE}/yaml.worker.js`
      case 'java':
        return `${MONACO_WORKER_BASE}/java.worker.js`
      case 'go':
        return `${MONACO_WORKER_BASE}/go.worker.js`
      case 'html':
      case 'markdown':
        return `${MONACO_WORKER_BASE}/html.worker.js`
      case 'css':
        return `${MONACO_WORKER_BASE}/css.worker.js`
      default:
        // 有代码高亮、查找、代码折叠等基础功能
        // 但是它不包含各个语言的智能分析、补全、校验等高级功能
        return `${MONACO_WORKER_BASE}/editor.worker.js`
    }
  },
}

const getQueryParam = (param) => {
  return new URLSearchParams(window.location.search).get(param)
}

const SentinelAppRoot = () => {
  const [windowType, setWindowType] = useState(getQueryParam('window'))

  useEffect(() => {
    getLocalValue(getRemoteI18nGV())
      .then((savedLang) => {
        if (savedLang) {
          i18n.changeLanguage(savedLang)
        }
      })
      .catch((err) => console.error(err))

    const onPopState = () => {
      setWindowType(getQueryParam('window'))
    }

    window.addEventListener('popstate', onPopState)

    // 捕获运行中的JS 语法错误及异常
    const onErrorLog = (event: ErrorEvent) => {
      debugToPrintLogs({
        page: 'index',
        fun: 'addEventListener error',
        content: event,
      })
    }
    window.addEventListener('error', onErrorLog)

    // 捕获运行中的Promise未处理的异常
    const onUnhandledrejectionLog = (event: PromiseRejectionEvent) => {
      debugToPrintLogs({
        page: 'index',
        fun: 'addEventListener unhandledrejection',
        content: event,
      })
    }
    window.addEventListener('unhandledrejection', onUnhandledrejectionLog)
    return () => {
      window.removeEventListener('popstate', onPopState)
      window.removeEventListener('error', onErrorLog)
      window.removeEventListener('unhandledrejection', onUnhandledrejectionLog)
    }
  }, [])

  const { theme } = useTheme()
  useEffect(() => {
    applyYakitThemeColors(theme, GetMainColor(theme))
  }, [theme])

  return <WindowRouter windowType={windowType} />
}

/** 按 URL 的 window 参数分发到对应窗口根组件 */
const WindowRouter: FC<{ windowType: string | null }> = ({ windowType }) => {
  switch (windowType) {
    case 'markdown-pdf-print':
      return <MarkdownPdfPrintPage />
    case 'child':
      return <SentinelChildWindow />
    default:
      return <SentinelWorkspace />
  }
}

/** 组合应用级 Provider，从内联 JSX 抽出以改变标签序列 */
const AppProviders: FC<{ children: ReactNode }> = ({ children }) => (
  <DndProvider backend={HTML5Backend}>
    <Suspense
      fallback={
        <div className="sentinel-root-loading" aria-busy="true">
          loading...
        </div>
      }
    >
      {children}
    </Suspense>
  </DndProvider>
)

/** 仅子窗口/markdown 打印窗口需要卸载首屏 loading 占位 */
const stripInitialLoading = () => {
  const params = window.location.search
  if (!params.includes('window=child') && !params.includes('window=markdown-pdf-print')) return
  document.getElementById('initial-loading')?.remove()
}

stripInitialLoading()

// ahooks useVirtualList 在 createRoot 下会出现渲染掉帧/闪烁，故沿用 ReactDOM.render；
// antd menu 多二级菜单在 createRoot 下有残留问题，待升级 antd5 后再切 createRoot。

registerAppSyncHandlers()
setupConcurrentStreamMainBridge()

const rootEl = document.getElementById('root')
ReactDOM.render(
  <AppProviders>
    <SentinelAppRoot />
  </AppProviders>,
  rootEl,
)
// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()
