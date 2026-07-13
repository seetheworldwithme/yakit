import { ColumnsTypeProps } from '@/components/TableVirtualResize/TableVirtualResizeType'
import { HoldGRPCStreamInfo, HoldGRPCStreamProps, StreamResult } from '@/hook/useHoldGRPCStream/useHoldGRPCStreamType'
import { ReactNode } from 'react'

export interface PluginExecuteResultProps {
  runtimeId: string
  streamInfo: HoldGRPCStreamInfo
  loading: boolean
  defaultActiveKey?: string
  pluginExecuteResultWrapper?: string
  PluginTabsRightNode?: React.ReactNode
  isCrawler?: boolean
  /** Data Card 是否改用表格展示（默认卡片流） */
  cardAsTable?: boolean
  /** 自定义表（type=table）tab 名映射：引擎原名 -> 展示名 */
  tableTabNameMap?: Record<string, string>
  /** 自定义表（type=table）列标题映射：引擎原标题 -> 中文标题 */
  columnTitleMap?: Record<string, string>
  /** 从任务列表打开的任务详情使用精简结果视图 */
  isTaskDetail?: boolean
}

export interface VulnerabilitiesRisksTableProps {
  runtimeId?: string
  runTimeIDs?: string[]
  filterTagDom?: ReactNode
  allTotal?: number
  setAllTotal?: (n: number) => void
  title?: string
  compactRiskDetail?: boolean
}

export interface AuditHoleTableOnTabProps {
  runtimeId: string
  title?: string
}

export interface PluginExecuteLogProps {
  loading: boolean
  messageList: StreamResult.Log[]
  wrapperClassName?: string
}

export interface PluginExecuteResultTabContentProps {
  title?: ReactNode
  extra?: ReactNode
  children?: ReactNode
  className?: string
}

export interface PluginExecuteWebsiteTreeProps {
  runtimeId: string
  website?: boolean
  filterTagDom?: React.ReactNode
  isCrawler?: boolean
  defaultExcludeColumnsKey?: string[]
  showActionIcons?: boolean
  showHistorySearchHint?: boolean
  showFavorites?: boolean
  resetQueryOnRefresh?: boolean
  hostColumnWidth?: number
  compactRiskDetail?: boolean
}
export interface PluginExecutePortTableProps {
  runtimeId: string
}

export interface PluginExecuteCustomTableProps {
  tableInfo: HoldGRPCStreamProps.InfoTable
  /** 列标题映射：引擎原标题 -> 展示标题（不影响 dataKey） */
  columnTitleMap?: Record<string, string>
}

export interface PluginExecuteCodeProps {
  content: string
}

export enum FileActionEnum {
  Read_Action = 'READ', // 读取
  Write_Action = 'WRITE', // 写入
  Create_Action = 'CREATE', // 创建
  Delete_Action = 'DELETE', // 删除
  Status_Action = 'STATUS', // 查看元信息
  Chmod_Action = 'CHMOD', // 修改权限
  Find_Action = 'FIND', // 查找
}
export declare namespace PluginExecuteLogFile {
  export type FileActionMessage =
    | ReadFileActionMessage
    | WriteFileActionMessage
    | CreateFileActionMessage
    | DELETEFileActionMessage
    | STATUSFileActionMessage
    | CHMODFileActionMessage
    | FINDFileActionMessage

  export interface FileItem {
    action: FileActionType
    action_message: FileActionMessage

    dir: string
    is_dir: boolean
    path: string
    title: string
  }

  export type FileActionType = `${FileActionEnum}`
  export interface ReadFileActionMessage {
    content: string
    length: number
    message: string
    offset: number
    unit: string
  }
  export interface WriteFileActionMessage {
    content: string
    length: number
    message: string
    mode: string
  }
  export interface CreateFileActionMessage {
    chmodMode: string
    isDir: boolean
    message: string
  }
  export interface DELETEFileActionMessage {
    message: string
    isDir: boolean
  }
  export interface STATUSFileActionMessage {
    message: string
    status: {
      FileAttributes: number
      CreationTime: {
        LowDateTime: number
        HighDateTime: number
      }
      LastAccessTime: {
        LowDateTime: number
        HighDateTime: number
      }
      LastWriteTime: {
        LowDateTime: number
        HighDateTime: number
      }
      FileSizeHigh: number
      FileSizeLow: number
      ReparseTag: number
    }
  }

  export interface CHMODFileActionMessage {
    message: string
    chmodMode: string
  }
  export interface FINDFileActionMessage {
    condition: string
    content: string[]
    message: string
    mode: string
  }
}
