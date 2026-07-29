import React, { memo, useRef, useMemo, useState, useReducer, useEffect } from 'react'
import { useMemoizedFn, useDebounceFn, useUpdateEffect, useInViewport } from 'ahooks'
import { OutlineTrashIcon, OutlineRefreshIcon, OutlineClouddownloadIcon, OutlinePlusIcon } from '@/assets/icon/outline'
import { YakitButton } from '@/components/yakitUI/YakitButton/YakitButton'
import { YakitTag } from '@/components/yakitUI/YakitTag/YakitTag'
import { YakitPopover } from '@/components/yakitUI/YakitPopover/YakitPopover'
import { YakitEmpty } from '@/components/yakitUI/YakitEmpty/YakitEmpty'
import { YakitCheckbox } from '@/components/yakitUI/YakitCheckbox/YakitCheckbox'
import { RemotePluginGV } from '@/enums/plugin'
import { PluginSearchParams, PluginListPageMeta, PluginFilterParams } from '@/pages/plugins/baseTemplateType'
import { defaultSearch } from '@/pages/plugins/builtInData'
import { YakitPluginOnlineDetail } from '@/pages/plugins/online/PluginsOnlineType'
import { pluginOnlineReducer, initialOnlineState } from '@/pages/plugins/pluginReducer'
import {
  PluginsQueryProps,
  convertPluginsRequestParams,
  apiFetchGroupStatisticsMine,
  DownloadOnlinePluginsRequest,
  convertDownloadOnlinePluginBatchRequestParams,
  apiDownloadPluginMine,
  apiDeletePluginMine,
  apiFetchMineList,
  excludeNoExistfilter,
} from '@/pages/plugins/utils'
import { getRemoteValue } from '@/utils/kv'
import { yakitNotify } from '@/utils/notification'
import cloneDeep from 'lodash/cloneDeep'
import { formatDate } from '@/utils/timeUtil'
import { NoPromptHint } from '../utilsUI/UtilsTemplate'
import { HubOuterList, OwnOptFooterExtra, HubDetailList, HubDetailListOpt } from './funcTemplate'
import { useStore } from '@/store'
import { OnlineJudgment } from '@/pages/plugins/onlineJudgment/OnlineJudgment'
import { YakitSpin } from '@/components/yakitUI/YakitSpin/YakitSpin'
import { HubListBaseProps } from '../type'
import { API } from '@/services/swagger/resposeType'
import { SolidPluscircleIcon } from '@/assets/icon/solid'
import emiter from '@/utils/eventBus/eventBus'
import { YakitRoute } from '@/enums/yakitRoute'
import { YakitGetOnlinePlugin } from '@/pages/mitm/MITMServerHijacking/MITMPluginLocalList'
import useGetSetState from '../hooks/useGetSetState'
import { FilterPopoverBtn } from '@/pages/plugins/funcTemplate'
import { Table, Tooltip } from 'antd'
import { SolidPrivatepluginIcon } from '@/assets/icon/colors'
import { statusTag } from '@/pages/plugins/baseTemplate'
import { DefaultOnlinePlugin, PluginOperateHint } from '../defaultConstant'
import { grpcDownloadOnlinePlugin, grpcFetchLocalPluginDetail } from '../utils/grpc'
import { defaultAddYakitScriptPageInfo } from '@/defaultConstants/AddYakitScript'
import { useI18nNamespaces } from '@/i18n/useI18nNamespaces'

import classNames from 'classnames'
import styles from './PluginHubList.module.scss'
import { JSONParseLog } from '@/utils/tool'
import { useEmptyImage } from '@/hook/useResultEmpty/SearchEmpty'
import { PluginOnlineImportModal } from './PluginOnlineImportModal'

interface HubListOwnProps extends HubListBaseProps {}
/** @name 我的插件 */
export const HubListOwn: React.FC<HubListOwnProps> = memo((props) => {
  const { hiddenFilter, isDetailList, hiddenDetailList, onPluginDetail } = props
  const { t } = useI18nNamespaces(['pluginHub', 'yakitUi'])
  const emptyImageTarget = useEmptyImage('search')

  const divRef = useRef<HTMLDivElement>(null)
  const [inViewPort = true] = useInViewport(divRef)

  const userinfo = useStore((s) => s.userInfo)
  const isLogin = useMemo(() => userinfo.isLogin, [userinfo])
  const fetchIsLogin = useMemoizedFn(() => userinfo.isLogin)

  /** ---------- 列表相关变量 Start ---------- */
  const [loading, setLoading] = useState<boolean>(false)
  // 是否为获取列表第一页的加载状态
  const isInitLoading = useRef<boolean>(false)
  const hasMore = useRef<boolean>(true)

  // 列表无条件下的总数
  const [listTotal, setListTotal] = useState<number>(0)

  // 分页
  const [pageNum, setPageNum] = useState<number>(1)
  const [pageSize, setPageSize] = useState<number>(20)

  const [filterGroup, setFilterGroup] = useState<API.PluginsSearch[]>([])

  // 列表数据
  const [response, dispatch] = useReducer(pluginOnlineReducer, initialOnlineState)
  // 全选
  const [allChecked, setAllChecked] = useState<boolean>(false)
  // 选中插件
  const [selectList, setSelectList] = useState<YakitPluginOnlineDetail[]>([])
  // 搜索条件
  const [search, setSearch, getSearch] = useGetSetState<PluginSearchParams>(cloneDeep(defaultSearch))
  const [filters, setFilters, getFilters] = useGetSetState<PluginFilterParams>({
    plugin_type: [],
    tags: [],
    status: [],
    plugin_private: [],
  })

  const showIndex = useRef<number>(0)
  const setShowIndex = useMemoizedFn((index: number) => {
    showIndex.current = index
  })
  /** ---------- 列表相关变量 End ---------- */

  /** ---------- 列表相关方法 Start ---------- */
  // 刷新搜索条件数据和无条件列表总数
  const onRefreshFilterAndTotal = useDebounceFn(
    useMemoizedFn(() => {
      fetchInitTotal()
      fetchFilterGroup()
    }),
    { wait: 300 },
  ).run

  useEffect(() => {
    if (isLogin) {
      handleRefreshList(true)
    }
  }, [isLogin])
  useUpdateEffect(() => {
    if (inViewPort && fetchIsLogin()) {
      onRefreshFilterAndTotal()
    }
  }, [inViewPort])
  /** 搜索条件 */
  useUpdateEffect(() => {
    if (!fetchIsLogin()) return
    fetchList(true)
  }, [filters])

  // 选中搜索条件可能在搜索数据组中不存在时进行清除
  useEffect(() => {
    const { realFilter, updateFilterFlag } = excludeNoExistfilter(filters, filterGroup)
    if (updateFilterFlag) setFilters(realFilter)
  }, [filters, filterGroup])

  const fetchInitTotal = useMemoizedFn(() => {
    apiFetchMineList({ page: 1, limit: 1 }, true)
      .then((res) => {
        setListTotal(Number(res.pagemeta.total) || 0)
      })
      .catch(() => {})
  })

  // 搜索条件分组数据
  const fetchFilterGroup = useMemoizedFn(() => {
    apiFetchGroupStatisticsMine()
      .then((res) => {
        setFilterGroup(res.data)
      })
      .catch(() => {})
  })

  // 拉取指定页（整页替换）
  const fetchPage = useMemoizedFn(async (page: number, limit: number, reset?: boolean) => {
    if (loading) return
    if (reset) {
      fetchInitTotal()
      isInitLoading.current = true
      setShowIndex(0)
    }
    setLoading(true)

    const params: PluginListPageMeta = { page, limit }
    const queryFilter = { ...getFilters() }
    const queryFearch = { ...getSearch() }
    const query: PluginsQueryProps = convertPluginsRequestParams(queryFilter, queryFearch, params)
    try {
      const res = await apiFetchMineList(query)
      if (!res.data) res.data = []
      hasMore.current = page * limit < +res.pagemeta.total
      dispatch({
        type: 'page',
        payload: {
          response: { ...res },
        },
      })
      if (page === 1) {
        onCheck(false)
      }
    } catch (error) {}
    setTimeout(() => {
      isInitLoading.current = false
      setLoading(false)
    }, 300)
  })

  const fetchList = useDebounceFn(
    useMemoizedFn(async (reset?: boolean) => {
      if (reset) setPageNum(1)
      await fetchPage(reset ? 1 : pageNum, pageSize, reset)
    }),
    { wait: 200, leading: true },
  ).run

  // 分页切换
  const onPaginationChange = useMemoizedFn((page: number, limit: number) => {
    setPageNum(page)
    setPageSize(limit)
    fetchPage(page, limit)
  })
  /** 滚动更多加载 */
  const onUpdateList = useMemoizedFn((reset?: boolean) => {
    fetchList()
  })
  /** 刷新 */
  const onRefresh = useMemoizedFn(() => {
    handleRefreshList(true)
  })

  /** 单项勾选 */
  const optCheck = useMemoizedFn((data: YakitPluginOnlineDetail, value: boolean) => {
    // 全选情况时的取消勾选
    if (allChecked) {
      setSelectList(response.data.filter((item) => item.uuid !== data.uuid))
      setAllChecked(false)
      return
    }
    // 单项勾选回调
    if (value) {
      setSelectList([...selectList, data])
    } else {
      const newSelectList = selectList.filter((item) => item.uuid !== data.uuid)
      setSelectList(newSelectList)
    }
  })
  /** 全选 */
  const onCheck = useMemoizedFn((value: boolean) => {
    setSelectList([])
    setAllChecked(value)
  })

  /** 搜索内容 */
  const onSearch = useDebounceFn(
    useMemoizedFn((val: PluginSearchParams) => {
      onCheck(false)
      setSearch(val)
      fetchList(true)
    }),
    { wait: 300, leading: true },
  ).run
  /** ---------- 列表相关方法 End ---------- */

  /** ---------- 通信监听 Start ---------- */
  // 刷新列表(是否刷新高级筛选数据)
  const handleRefreshList = useDebounceFn(
    useMemoizedFn((updateFilterGroup?: boolean) => {
      if (!fetchIsLogin()) return
      if (updateFilterGroup) fetchFilterGroup()
      fetchList(true)
    }),
    { wait: 200 },
  ).run

  // 详情删除线上插件触发列表的局部更新
  const handleDetailDeleteToOnline = useMemoizedFn((info: string) => {
    if (!info) return
    try {
      const plugin: { name: string; uuid: string } = JSONParseLog(info, {
        page: 'HubListOwn',
        fun: 'handleDetailDeleteToOnline',
      })
      if (!plugin.name && !plugin.uuid) return
      const index = selectList.findIndex((ele) => ele.uuid === plugin.uuid)
      const data: YakitPluginOnlineDetail = {
        ...DefaultOnlinePlugin,
        uuid: plugin.uuid || '',
        script_name: plugin.name || '',
      }
      if (index !== -1) {
        optCheck(data, false)
      }
      onRefreshFilterAndTotal()
      emiter.emit('ownDeleteToRecycleList')
      dispatch({
        type: 'remove',
        payload: {
          itemList: [data],
        },
      })
    } catch (error) {}
  })

  // 详情里改公开|私密后更新列表里的插件信息
  const handleChangeStatus = useMemoizedFn((content: string) => {
    if (!content) return
    try {
      const plugin: { name: string; uuid: string; is_private: boolean; status: number } = JSONParseLog(content, {
        page: 'HubListOwn',
        fun: 'handleChangeStatus',
      })
      if (!plugin.name && !plugin.uuid) return
      const el = response.data.find((ele) => ele.uuid === plugin.uuid)
      if (!el) return
      const data: YakitPluginOnlineDetail = {
        ...el,
        is_private: plugin.is_private,
        status: plugin.status,
      }
      dispatch({
        type: 'update',
        payload: {
          item: data,
        },
      })
    } catch (error) {}
  })

  useEffect(() => {
    emiter.on('onRefreshOwnPluginList', handleRefreshList)
    emiter.on('detailDeleteOwnPlugin', handleDetailDeleteToOnline)
    emiter.on('detailChangeStatusOwnPlugin', handleChangeStatus)
    return () => {
      emiter.off('onRefreshOwnPluginList', handleRefreshList)
      emiter.off('detailDeleteOwnPlugin', handleDetailDeleteToOnline)
      emiter.off('detailChangeStatusOwnPlugin', handleChangeStatus)
    }
  }, [])
  /** ---------- 通信监听 Start ---------- */

  const listLength = useMemo(() => {
    return Number(response.pagemeta.total) || 0
  }, [response])
  const selectedNum = useMemo(() => {
    if (allChecked) return response.pagemeta.total
    else return selectList.length
  }, [allChecked, selectList, response.pagemeta.total])

  /** ---------- 下载插件 Start ---------- */
  useEffect(() => {
    // 批量下载的同名覆盖二次确认框缓存
    getRemoteValue(RemotePluginGV.BatchDownloadPluginSameNameOverlay)
      .then((res) => {
        batchSameNameCache.current = res === 'true'
      })
      .catch((err) => {})
    // 单个下载的同名覆盖二次确认框缓存
    getRemoteValue(RemotePluginGV.SingleDownloadPluginSameNameOverlay)
      .then((res) => {
        singleSameNameCache.current = res === 'true'
      })
      .catch((err) => {})
  }, [])

  // 单个下载
  const singleSameNameCache = useRef<boolean>(false)
  const [singleSameNameHint, setSingleSameNameHint] = useState<boolean>(false)
  const handleSingleSameNameHint = useMemoizedFn((isOK: boolean, cache: boolean) => {
    if (isOK) {
      singleSameNameCache.current = cache
      const data = singleDownload[singleDownload.length - 1]
      if (data) handleSingleDownload(data)
    } else {
      setSingleDownload((arr) => arr.slice(0, arr.length - 1))
    }
    setSingleSameNameHint(false)
  })
  // 单个下载的插件信息队列
  const [singleDownload, setSingleDownload] = useState<YakitPluginOnlineDetail[]>([])
  const onFooterExtraDownload = useMemoizedFn((info: YakitPluginOnlineDetail) => {
    const findIndex = singleDownload.findIndex((item) => item.uuid === info.uuid)
    if (findIndex > -1) {
      yakitNotify('error', t('HubListOwn.downloadingBusy'))
      return
    }
    setSingleDownload((arr) => {
      arr.push(info)
      return [...arr]
    })

    grpcFetchLocalPluginDetail({ Name: info.script_name, UUID: info.uuid }, true)
      .then((res) => {
        const { ScriptName, UUID } = res
        if (ScriptName === info.script_name && UUID !== info.uuid) {
          if (!singleSameNameCache.current) {
            if (singleSameNameHint) return
            setSingleSameNameHint(true)
            return
          }
        }
        handleSingleDownload(info)
      })
      .catch((err) => {
        handleSingleDownload(info)
      })
  })
  // 单个插件下载
  const handleSingleDownload = useMemoizedFn((info: YakitPluginOnlineDetail) => {
    grpcDownloadOnlinePlugin({ uuid: info.uuid })
      .then((res) => {
        emiter.emit(
          'editorLocalSaveToLocalList',
          JSON.stringify({
            id: Number(res.Id) || 0,
            name: res.ScriptName,
            uuid: res.UUID || '',
          }),
        )
        yakitNotify('success', t('PluginHubDetail.downloadSuccess'))
      })
      .catch(() => {})
      .finally(() => {
        setTimeout(() => {
          setSingleDownload((arr) => arr.filter((item) => item.uuid !== info.uuid))
        }, 50)
      })
  })

  const [allDownloadHint, setAllDownloadHint] = useState<boolean>(false)
  // 全部下载
  const handleAllDownload = useMemoizedFn(() => {
    if (allDownloadHint) return
    setAllDownloadHint(true)
  })

  const [batchDownloadLoading, setBatchDownloadLoading] = useState<boolean>(false)
  // 批量下载
  const handleBatchDownload = useMemoizedFn(() => {
    if (batchDownloadLoading) return

    let request: DownloadOnlinePluginsRequest = {}
    if (selectedNum > 0) {
      if (allChecked) {
        request = {
          ...request,
          ...convertDownloadOnlinePluginBatchRequestParams({ ...getFilters() }, { ...getSearch() }),
        }
      } else {
        request = {
          ...request,
          UUID: selectList.map((item) => item.uuid),
        }
      }
    }

    setBatchDownloadLoading(true)
    apiDownloadPluginMine(request)
      .then(() => {
        emiter.emit('onRefreshLocalPluginList', true)
      })
      .catch(() => {})
      .finally(() => {
        setTimeout(() => {
          onCheck(false)
          setBatchDownloadLoading(false)
        }, 200)
      })
  })

  const batchSameNameCache = useRef<boolean>(false)
  const [batchSameNameHint, setBatchSameNameHint] = useState<boolean>(false)
  const handleBatchSameNameHint = useMemoizedFn((isOK: boolean, cache: boolean) => {
    if (isOK) {
      batchSameNameCache.current = cache
      handleBatchDownloadPlugin()
    }
    setBatchSameNameHint(false)
  })

  const onHeaderExtraDownload = useMemoizedFn(() => {
    if (!batchSameNameCache.current) {
      if (batchSameNameHint) return
      setBatchSameNameHint(true)
      return
    }
    handleBatchDownloadPlugin()
  })
  const handleBatchDownloadPlugin = useMemoizedFn(() => {
    if (selectedNum > 0) {
      handleBatchDownload()
    } else {
      handleAllDownload()
    }
  })
  /** ---------- 下载插件 End ---------- */

  /** ---------- 删除插件 Start ---------- */
  useEffect(() => {
    // 删除插件的二次确认弹框
    getRemoteValue(RemotePluginGV.UserPluginRemoveCheck)
      .then((res) => {
        delHintCache.current = res === 'true'
      })
      .catch((err) => {})
  }, [])

  // 是否出现二次确认框
  const delHintCache = useRef<boolean>(false)
  // 出发二次确认框的操作源
  const delHintSource = useRef<'batch' | 'single'>('single')
  const [delHint, setDelHint] = useState<boolean>(false)
  const onOpenDelHint = useMemoizedFn((source: 'batch' | 'single') => {
    if (delHint) return
    delHintSource.current = source
    setDelHint(true)
  })
  const delHintCallback = useMemoizedFn((isOK: boolean, cache: boolean) => {
    if (isOK) {
      delHintCache.current = cache
      if (delHintSource.current === 'batch') {
        handleBatchDel()
      }
      if (delHintSource.current === 'single') {
        const info = singleDel[singleDel.length - 1]
        if (info) handleSingeDel(info)
      }
    } else {
      if (delHintSource.current === 'single') {
        setSingleDel((arr) => arr.slice(0, arr.length - 1))
      }
    }
    setDelHint(false)
  })

  const [batchDelLoading, setBatchDelLoading] = useState<boolean>(false)
  const onHeaderExtraDel = useMemoizedFn(() => {
    if (delHintCache.current) {
      handleBatchDel()
    } else {
      onOpenDelHint('batch')
    }
  })
  // 批量删除
  const handleBatchDel = useMemoizedFn(async () => {
    if (batchDelLoading) return
    setBatchDelLoading(true)

    try {
      let request: API.PluginsWhereDeleteRequest | undefined = undefined
      if (allChecked) {
        request = { ...convertPluginsRequestParams(filters, search) }
      }
      if (!allChecked && selectedNum > 0) {
        request = { uuid: selectList.map((item) => item.uuid) }
      }
      await apiDeletePluginMine(request)
    } catch (error) {}
    onCheck(false)
    fetchFilterGroup()
    emiter.emit('ownDeleteToRecycleList')
    fetchList(true)
    setTimeout(() => {
      setBatchDelLoading(false)
    }, 200)
  })

  // 单个删除的插件信息队列
  const [singleDel, setSingleDel] = useState<YakitPluginOnlineDetail[]>([])
  const onFooterExtraDel = useMemoizedFn((info: YakitPluginOnlineDetail) => {
    const findIndex = singleDel.findIndex((item) => item.uuid === info.uuid)
    if (findIndex > -1) {
      yakitNotify('error', t('HubListOwn.deletingBusy'))
      return
    }
    setSingleDel((arr) => {
      arr.push(info)
      return [...arr]
    })
    if (delHintCache.current) {
      handleSingeDel(info)
    } else {
      onOpenDelHint('single')
    }
  })
  // 单个删除
  const handleSingeDel = useMemoizedFn((info: YakitPluginOnlineDetail) => {
    let request: API.PluginsWhereDeleteRequest = {
      uuid: [info.uuid],
    }
    apiDeletePluginMine(request)
      .then(() => {
        const index = selectList.findIndex((ele) => ele.uuid === info.uuid)
        if (index !== -1) {
          optCheck(info, false)
        }
        onRefreshFilterAndTotal()
        emiter.emit('ownDeleteToRecycleList')
        dispatch({
          type: 'remove',
          payload: {
            itemList: [info],
          },
        })
      })
      .catch(() => {})
      .finally(() => {
        setTimeout(() => {
          setSingleDel((arr) => arr.filter((item) => item.uuid !== info.uuid))
        }, 50)
      })
  })
  /** ---------- 删除插件 End ---------- */

  /** ---------- 单个操作(下载|改为公开/私密)的回调 Start ---------- */
  const optCallback = useMemoizedFn((type: string, info: YakitPluginOnlineDetail) => {
    if (type === 'state') {
      dispatch({
        type: 'update',
        payload: {
          item: info,
        },
      })
    }
  })
  /** ---------- 单个操作(下载|改为公开/私密)的回调 End ---------- */

  // 新建插件
  const onNewPlugin = useMemoizedFn(() => {
    emiter.emit(
      'openPage',
      JSON.stringify({
        route: YakitRoute.AddYakitScript,
        params: { ...defaultAddYakitScriptPageInfo, source: YakitRoute.Plugin_Hub },
      }),
    )
  })

  const [importPluginVisible, setImportPluginVisible] = useState(false)
  const handleImportPluginSuccess = useMemoizedFn(() => {
    setImportPluginVisible(false)
    handleRefreshList(true)
  })

  /** ---------- 详情列表操作 Start ---------- */
  // 进入插件详情
  const onOptClick = useMemoizedFn((info: YakitPluginOnlineDetail, index: number) => {
    if (!info.script_name && !info.uuid) {
      yakitNotify('error', t('HubListOwn.refreshListRetry'))
      return
    }
    setShowIndex(index)
    onPluginDetail({ type: 'own', name: info.script_name, uuid: info.uuid, isCorePlugin: !!info.isCorePlugin })
  })

  // 触发详情列表的单项定位
  const [scrollTo, setScrollTo] = useState<number>(0)
  useUpdateEffect(() => {
    if (isDetailList) {
      // setTimeout(() => {
      //     setScrollTo(showIndex.current)
      // }, 100)
    }
  }, [isDetailList])

  /** 详情条件搜索 */
  const onDetailFilter = useMemoizedFn((value: PluginFilterParams) => {
    onCheck(false)
    setFilters(value)
    fetchList(true)
  })

  // 详情单项副标题
  const detailOptSubTitle = useMemoizedFn((info: YakitPluginOnlineDetail) => {
    return info.is_private ? <SolidPrivatepluginIcon className="icon-svg-16" /> : statusTag[`${info.status}`]
  })
  /** ---------- 详情列表操作 End ---------- */

  // 批量的删除和还原
  // 高级筛选-横排单项切换
  const toggleFilter = useMemoizedFn((groupKey: string, data: API.PluginsSearchData, check: boolean) => {
    const selected = { ...(filters as Record<string, API.PluginsSearchData[]>) }
    if (check) selected[groupKey] = [...(selected[groupKey] || []), data]
    else selected[groupKey] = (selected[groupKey] || []).filter((item) => item.value !== data.value)
    setFilters({ ...selected })
  })

  // 表格列定义
  const tableColumns = useMemo<any[]>(() => {
    const selectedSet = new Set(selectList.map((item) => item.uuid))
    return [
      {
        title: () => (
          <YakitCheckbox
            indeterminate={!allChecked && selectList.length > 0}
            checked={allChecked}
            onChange={(e) => onCheck(e.target.checked)}
          />
        ),
        dataIndex: 'uuid',
        width: 44,
        render: (_: any, record: YakitPluginOnlineDetail) => (
          <YakitCheckbox
            checked={allChecked || selectedSet.has(record.uuid)}
            onChange={(e) => optCheck(record, e.target.checked)}
            onClick={(e) => e.stopPropagation()}
          />
        ),
      },
      {
        title: t('HubListLocal.pluginName'),
        dataIndex: 'script_name',
        ellipsis: true,
        render: (text: string) => <span className={styles['col-name-text']}>{text || '-'}</span>,
      },
      {
        title: t('HubListLocal.pluginDesc'),
        dataIndex: 'help',
        ellipsis: true,
        render: (text: string) => (
          <Tooltip title={text || ''} overlayClassName="plugins-tooltip">
            <span className={styles['col-desc']}>{text || '-'}</span>
          </Tooltip>
        ),
      },
      {
        title: '上传者',
        dataIndex: 'authors',
        width: 140,
        ellipsis: true,
        render: (author: string) => author || '-',
      },
      {
        title: '标签',
        dataIndex: 'tags',
        width: 220,
        render: (tags: string) => {
          const values = (tags || '').split(',').filter(Boolean)
          return values.length ? (
            <div className={styles['col-tags']}>
              {values.map((tag) => (
                <YakitTag key={tag} color="main">
                  {tag}
                </YakitTag>
              ))}
            </div>
          ) : (
            '-'
          )
        },
      },
      {
        title: t('HubListLocal.createdAt'),
        dataIndex: 'updated_at',
        width: 160,
        render: (ts?: number) => (ts ? formatDate(ts) : '-'),
      },
      {
        title: t('HubListLocal.operation'),
        width: 150,
        render: (_: any, record: YakitPluginOnlineDetail) => {
          // 权限：仅作者本人或管理员可删除
          const canManage = record.user_id === userinfo.user_id || userinfo.role === 'admin'
          return (
            <div className={styles['col-ops']} onClick={(e) => e.stopPropagation()}>
              <YakitButton type="text2" onClick={() => onFooterExtraDownload(record)}>
                {t('YakitButton.download')}
              </YakitButton>
              {canManage && (
                <YakitButton type="text2" danger onClick={() => onFooterExtraDel(record)}>
                  {t('YakitButton.delete')}
                </YakitButton>
              )}
            </div>
          )
        },
      },
    ]
  }, [allChecked, selectList, t, userinfo.user_id, userinfo.role])
  // 单项副标题
  const optSubTitle = useMemoizedFn((info: YakitPluginOnlineDetail) => {
    return <>{info.is_private ? <SolidPrivatepluginIcon /> : statusTag[`${info.status}`]}</>
  })
  // 单项的下载|分享|改为公开/私密|删除
  const extraFooter = (info: YakitPluginOnlineDetail) => {
    return (
      <OwnOptFooterExtra
        isLogin={isLogin}
        info={info}
        execDownloadInfo={singleDownload}
        onDownload={onFooterExtraDownload}
        execDelInfo={singleDel}
        onDel={onFooterExtraDel}
        callback={optCallback}
      />
    )
  }

  return (
    <section
      className={classNames(styles['plugin-hub-tab-list'], styles['plugin-hub-local-shell'], {
        [styles['plugin-hub-tab-detail-list']]: isDetailList && !hiddenDetailList && !isLogin,
      })}
    >
      <OnlineJudgment isJudgingLogin={true}>
        <YakitSpin
          wrapperClassName={isDetailList ? styles['hidden-view'] : ''}
          spinning={loading && isInitLoading.current}
        >
          <div className={styles['outer-list']}>
            <div className={styles['hub-local-column']}>
              {/* 暂时隐藏独立高级筛选行，筛选项已移入“我的插件”标题后
              <div className={classNames(styles['hub-filter-row'], { [styles['hidden-view']]: hiddenFilter })}>
                <span className={styles['hub-filter-row-title']}>{t('YakitButton.advancedFilter')}</span>
                <div className={styles['hub-filter-row-groups']}>
                  {filterGroup
                    .filter((group) => ['plugin_type', 'tags'].includes(group.groupKey))
                    .map((group) => {
                      const selected = ((filters as Record<string, API.PluginsSearchData[]>)[group.groupKey] ||
                        []) as API.PluginsSearchData[]
                      return (
                        <div className={styles['hub-filter-group']} key={group.groupKey}>
                          <span className={styles['hub-filter-group-name']}>{group.groupName}</span>
                          <div className={styles['hub-filter-group-items']}>
                            {(group.data || []).map((opt) => {
                              const active = selected.some((s) => s.value === opt.value)
                              return (
                                <span
                                  key={opt.value}
                                  className={classNames(styles['hub-filter-chip'], {
                                    [styles['hub-filter-chip-active']]: active,
                                  })}
                                  onClick={() => toggleFilter(group.groupKey, opt, !active)}
                                >
                                  <span className={styles['hub-filter-chip-label']}>{opt.label}</span>
                                  {!!opt.count && <em className={styles['hub-filter-chip-count']}>{opt.count}</em>}
                                </span>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                </div>
              </div> */}

              <main className={styles['list-body']}>
                <HubOuterList
                  title={
                    <div className={styles['hub-inline-title-filters']}>
                      <span>{t('HubListOwn.myPlugins')}</span>
                      {filterGroup
                        .filter((group) => ['plugin_type', 'plugin_group', 'tags'].includes(group.groupKey))
                        .sort(
                          (a, b) =>
                            ['plugin_type', 'plugin_group', 'tags'].indexOf(a.groupKey) -
                            ['plugin_type', 'plugin_group', 'tags'].indexOf(b.groupKey),
                        )
                        .map((group) => {
                          const selected = ((filters as Record<string, API.PluginsSearchData[]>)[group.groupKey] ||
                            []) as API.PluginsSearchData[]
                          const inlineOptions = (group.data || []).slice(0, 3)
                          const remainingOptions = (group.data || []).slice(3)
                          return (
                            <div className={styles['hub-inline-filter-group']} key={group.groupKey}>
                              <span>{group.groupName}</span>
                              {inlineOptions.map((opt) => {
                                const active = selected.some((item) => item.value === opt.value)
                                return (
                                  <YakitButton
                                    key={opt.value}
                                    type={active ? 'primary' : 'text'}
                                    size="small"
                                    onClick={() => toggleFilter(group.groupKey, opt, !active)}
                                  >
                                    {opt.label}
                                  </YakitButton>
                                )
                              })}
                              {remainingOptions.length > 0 && (
                                <YakitPopover
                                  overlayClassName={styles['hub-inline-filter-popover']}
                                  placement="bottomLeft"
                                  trigger="click"
                                  content={
                                    <div className={styles['hub-inline-filter-popover-content']}>
                                      {remainingOptions.map((opt) => {
                                        const active = selected.some((item) => item.value === opt.value)
                                        return (
                                          <YakitButton
                                            key={opt.value}
                                            type={active ? 'primary' : 'text'}
                                            size="small"
                                            onClick={() => toggleFilter(group.groupKey, opt, !active)}
                                          >
                                            {opt.label}
                                          </YakitButton>
                                        )
                                      })}
                                    </div>
                                  }
                                >
                                  <YakitButton
                                    type={
                                      remainingOptions.some((opt) => selected.some((item) => item.value === opt.value))
                                        ? 'primary'
                                        : 'text'
                                    }
                                    size="small"
                                  >
                                    更多 +{remainingOptions.length}
                                  </YakitButton>
                                </YakitPopover>
                              )}
                            </div>
                          )
                        })}
                    </div>
                  }
                  headerExtra={
                    <div className={styles['hub-list-header-extra']}>
                      <YakitButton type="primary" icon={<SolidPluscircleIcon />} onClick={onNewPlugin}>
                        {t('HubListOwn.newPlugin')}
                      </YakitButton>
                      <YakitButton
                        type="outline2"
                        size="large"
                        icon={<OutlinePlusIcon />}
                        onClick={() => setImportPluginVisible(true)}
                      >
                        批量导入到云端
                      </YakitButton>
                      <YakitButton
                        type="outline2"
                        size="large"
                        icon={<OutlineClouddownloadIcon />}
                        loading={batchDownloadLoading}
                        disabled={listTotal === 0}
                        onClick={onHeaderExtraDownload}
                      >
                        {selectedNum > 0 ? t('YakitButton.download') : t('YakitButton.oneClickDownload')}
                      </YakitButton>
                      <YakitButton
                        type="outline2"
                        size="large"
                        icon={<OutlineTrashIcon />}
                        disabled={listTotal === 0}
                        loading={batchDelLoading}
                        onClick={onHeaderExtraDel}
                      >
                        {selectedNum > 0 ? t('YakitButton.delete') : t('YakitButton.clear')}
                      </YakitButton>
                    </div>
                  }
                  allChecked={allChecked}
                  setAllChecked={onCheck}
                  total={response.pagemeta.total}
                  selected={selectedNum}
                  search={search}
                  setSearch={setSearch}
                  onSearch={onSearch}
                  filters={filters as Record<string, API.PluginsSearchData[]>}
                  setFilters={setFilters}
                  hideFilterTags={true}
                >
                  {listLength > 0 ? (
                    <div className={styles['hub-local-table-wrap']}>
                      <Table<YakitPluginOnlineDetail>
                        rowKey="uuid"
                        size="small"
                        columns={tableColumns}
                        dataSource={response.data}
                        pagination={{
                          current: pageNum,
                          pageSize: pageSize,
                          total: +response.pagemeta.total || 0,
                          showSizeChanger: true,
                          pageSizeOptions: ['10', '20', '50', '100'],
                          onChange: onPaginationChange,
                        }}
                        scroll={{ y: 'calc(100vh - 360px)' }}
                        tableLayout="fixed"
                        loading={loading}
                        onRow={(record) => {
                          const idx = (response.data || []).findIndex((ele) => ele.uuid === record.uuid)
                          return {
                            onClick: () => onOptClick(record, idx),
                            className: styles['hub-local-table-row'],
                          }
                        }}
                      />
                    </div>
                  ) : listTotal > 0 ? (
                    <YakitEmpty
                      image={emptyImageTarget}
                      imageStyle={{ margin: '0 auto 24px', width: 274, height: 180 }}
                      title={t('YakitEmpty.searchEmpty')}
                      className={styles['hub-list-empty']}
                    />
                  ) : (
                    <div className={styles['hub-list-empty']}>
                      <YakitEmpty title={t('YakitEmpty.noData')} description={t('HubListOwn.noDataDesc')} />
                      <div className={styles['refresh-buttons']}>
                        <YakitButton type="outline1" icon={<OutlinePlusIcon />} onClick={onNewPlugin}>
                          {t('HubListOwn.newPlugin')}
                        </YakitButton>
                        <YakitButton type="outline1" icon={<OutlineRefreshIcon />} onClick={onRefresh}>
                          {t('YakitButton.refresh')}
                        </YakitButton>
                      </div>
                    </div>
                  )}
                </HubOuterList>
              </main>
            </div>
          </div>
        </YakitSpin>

        {isDetailList && (
          <div className={classNames(styles['inner-list'], { [styles['hidden-view']]: hiddenDetailList })}>
            <HubDetailList
              search={search}
              setSearch={setSearch}
              onSearch={onSearch}
              checked={allChecked}
              onCheck={onCheck}
              total={listLength}
              selected={selectedNum}
              filterExtra={
                <div className={styles['hub-detail-list-extra']}>
                  <FilterPopoverBtn defaultFilter={filters} onFilter={onDetailFilter} type="user" />
                  <div className={styles['divider-style']}></div>
                  <Tooltip
                    title={selectedNum > 0 ? t('YakitButton.download') : t('YakitButton.oneClickDownload')}
                    overlayClassName="plugins-tooltip"
                  >
                    <YakitButton
                      type="text2"
                      loading={batchDownloadLoading}
                      disabled={listTotal === 0}
                      icon={<OutlineClouddownloadIcon />}
                      onClick={onHeaderExtraDownload}
                    />
                  </Tooltip>
                  {/* <div className={styles["divider-style"]}></div>
                                    <Tooltip
                                        title={selectedNum > 0 ? "删除" : "清空"}
                                        overlayClassName='plugins-tooltip'
                                    >
                                        <YakitButton
                                            type='text2'
                                            loading={batchDelLoading}
                                            disabled={listTotal === 0}
                                            icon={<OutlineTrashIcon />}
                                            onClick={onHeaderExtraDel}
                                        />
                                    </Tooltip> */}
                </div>
              }
              listProps={{
                rowKey: 'uuid',
                numberRoll: scrollTo,
                data: response.data,
                loadMoreData: onUpdateList,
                classNameRow: styles['hub-detail-list-opt'],
                renderRow: (info, i) => {
                  const check = allChecked || selectList.findIndex((item) => item.uuid === info.uuid) !== -1
                  return (
                    <HubDetailListOpt
                      order={i}
                      plugin={info}
                      check={check}
                      headImg={info.head_img}
                      pluginName={info.script_name}
                      help={info.help}
                      content={info.content}
                      optCheck={optCheck}
                      official={info.official}
                      isCorePlugin={!!info.isCorePlugin}
                      pluginType={info.type}
                      extra={detailOptSubTitle}
                      onPluginClick={onOptClick}
                    />
                  )
                },
                page: response.pagemeta.page,
                hasMore: hasMore.current,
                loading: loading,
                defItemHeight: 46,
                isRef: loading && isInitLoading.current,
              }}
              spinLoading={loading && isInitLoading.current}
            />
          </div>
        )}

        <PluginOnlineImportModal
          visible={importPluginVisible}
          onCancel={() => setImportPluginVisible(false)}
          onSuccess={handleImportPluginSuccess}
        />
      </OnlineJudgment>

      <NoPromptHint
        visible={delHint}
        title={t('HubListOwn.deleteConfirm')}
        content={PluginOperateHint['delOnline']}
        cacheKey={RemotePluginGV.UserPluginRemoveCheck}
        onCallback={delHintCallback}
      />

      {allDownloadHint && (
        <YakitGetOnlinePlugin
          visible={allDownloadHint}
          setVisible={() => setAllDownloadHint(false)}
          listType="mine"
          getContainer={document.getElementById(`main-operator-page-body-${YakitRoute.Plugin_Hub}`) || undefined}
        />
      )}

      {/* 批量下载同名覆盖提示 */}
      <NoPromptHint
        visible={batchSameNameHint}
        title={t('HubListOwn.sameNameHintTitle')}
        content={t('HubListOwn.batchSameNameContent')}
        cacheKey={RemotePluginGV.BatchDownloadPluginSameNameOverlay}
        onCallback={handleBatchSameNameHint}
      />

      {/* 单个下载同名覆盖提示 */}
      <NoPromptHint
        visible={singleSameNameHint}
        title={t('HubListOwn.sameNameHintTitle')}
        content={t('HubListOwn.sameNameDownloadContent')}
        cacheKey={RemotePluginGV.SingleDownloadPluginSameNameOverlay}
        onCallback={handleSingleSameNameHint}
      />
    </section>
  )
})
