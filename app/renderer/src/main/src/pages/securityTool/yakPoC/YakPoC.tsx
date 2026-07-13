import React, { ReactElement, useEffect, useReducer, useRef, useState } from 'react'
import {
  PluginExecuteLogProps,
  PluginGroupByKeyWordItemProps,
  PluginGroupByKeyWordProps,
  PluginGroupPluginInlineProps,
  PluginLogProps,
  TimeConsumingProps,
  YakPoCExecuteContentProps,
  YakPoCProps,
} from './YakPoCType'
import classNames from 'classnames'
import styles from './YakPoC.module.scss'
import { Tooltip } from 'antd'
import { YakitCheckbox } from '@/components/yakitUI/YakitCheckbox/YakitCheckbox'
import { YakitButton } from '@/components/yakitUI/YakitButton/YakitButton'
import {
  HybridScanExecuteContent,
  HybridScanExecuteContentRefProps,
} from '@/pages/plugins/pluginBatchExecutor/pluginBatchExecutor'
import {
  useControllableValue,
  useCreation,
  useDebounceFn,
  useInViewport,
  useInterval,
  useMemoizedFn,
  useUpdateEffect,
} from 'ahooks'
import { StreamResult } from '@/hook/useHoldGRPCStream/useHoldGRPCStreamType'
import { ExpandAndRetractExcessiveState } from '@/pages/plugins/operator/expandAndRetract/ExpandAndRetract'
import {
  OutlineArrowscollapseIcon,
  OutlineArrowsexpandIcon,
  OutlineCloseIcon,
  OutlineOpenIcon,
} from '@/assets/icon/outline'
import { RollingLoadList } from '@/components/RollingLoadList/RollingLoadList'
import { SolidCloudpluginIcon, SolidPrivatepluginIcon } from '@/assets/icon/colors'
import { YakitEmpty } from '@/components/yakitUI/YakitEmpty/YakitEmpty'
import { CloudDownloadIcon } from '@/assets/newIcon'
import { YakitGetOnlinePlugin } from '@/pages/mitm/MITMServerHijacking/MITMPluginLocalList'
import { PageNodeItemProps, PocPageInfoProps, usePageInfo } from '@/store/pageInfo'
import { shallow } from 'zustand/shallow'
import { YakitRoute } from '@/enums/yakitRoute'
import { GroupCount, QueryYakScriptRequest, SaveYakScriptGroupRequest, YakScript } from '@/pages/invoker/schema'
import {
  YakPoCExecutorInputValueProps,
  apiFetchDeleteYakScriptGroupLocal,
  apiFetchSaveYakScriptGroupLocal,
  apiQueryYakScript,
  hybridScanParamsConvertToInputValue,
} from '@/pages/plugins/utils'
import emiter from '@/utils/eventBus/eventBus'
import { apiFetchQueryYakScriptGroupLocalByPoc } from './utils'
import { PluginListPageMeta } from '@/pages/plugins/baseTemplateType'
import { initialLocalState, pluginLocalReducer } from '@/pages/plugins/pluginReducer'
import { getRemoteValue, setRemoteValue } from '@/utils/kv'
import { PluginDetailsListItem } from '@/pages/plugins/baseTemplate'
import moment from 'moment'
import { YakitSpin } from '@/components/yakitUI/YakitSpin/YakitSpin'
import { compareAsc } from '@/pages/yakitStore/viewers/base'
import { batchPluginType } from '@/defaultConstants/PluginBatchExecutor'
import { defaultPocPageInfo } from '@/defaultConstants/YakPoC'
import { HybridScanControlAfterRequest } from '@/models/HybridScan'
import { getReleaseEditionName, getRemoteHttpSettingGV } from '@/utils/envfile'
import { TFunction, useI18nNamespaces } from '@/i18n/useI18nNamespaces'

const HybridScanTaskListDrawer = React.lazy(
  () => import('@/pages/plugins/pluginBatchExecutor/HybridScanTaskListDrawer'),
)

export const onToManageGroup = () => {
  emiter.emit(
    'openPage',
    JSON.stringify({
      route: YakitRoute.Plugin_Hub,
      params: { tabActive: 'local', openGroupDrawer: true },
    }),
  )
}

/**专项漏洞检测 */
export const YakPoC: React.FC<YakPoCProps> = React.memo((props) => {
  const { t } = useI18nNamespaces(['yakPoC'])
  const { pageId } = props

  const { queryPagesDataById } = usePageInfo(
    (s) => ({
      queryPagesDataById: s.queryPagesDataById,
    }),
    shallow,
  )
  const initPageInfo = useMemoizedFn(() => {
    const currentItem: PageNodeItemProps | undefined = queryPagesDataById(YakitRoute.PoC, pageId)
    if (currentItem && currentItem.pageParamsInfo.pocPageInfo) {
      return currentItem.pageParamsInfo.pocPageInfo
    }
    return { ...defaultPocPageInfo }
  })
  const [pageInfo, setPageInfo] = useState<PocPageInfoProps>(initPageInfo())
  const [keyWordResponseToSelect, setKeyWordResponseToSelect] = useState<GroupCount[]>([])

  // 隐藏插件列表
  const [hidden, setHidden] = useState<boolean>(false)

  const [executeStatus, setExecuteStatus] = useState<ExpandAndRetractExcessiveState>('default')
  const [pluginExecuteLog, setPluginExecuteLog] = useState<StreamResult.PluginExecuteLog[]>([])
  const [visibleTaskList, setVisibleTaskList] = useState<boolean>(false)
  const isTaskDetail = !!pageInfo.runtimeId

  // LINK #deleted-init-group-all
  // LINK #set-init-group-all
  const [initSelectGroupAll, setInitSelectGroupAll] = useState<string[]>([]) //任务列表查询/继续，先保存记录的选中组，等待处理完后，清空该值
  const [deletedGroup, setDeletedGroup] = useState<string[]>([]) // 任务列表点击查看/继续的时候被删除的组(包括关键词组的临时组、插件管理中被删除的组)

  const pluginGroupRef = useRef<HTMLDivElement>(null)
  const [inViewport = true] = useInViewport(pluginGroupRef)

  useEffect(() => {
    return () => {
      // 页面被关闭得时候，需要删除该页面得临时查询组
      apiFetchQueryYakScriptGroupLocalByPoc({ PageId: pageId }).then((res) => {
        const removeGroup = res
          .filter((item) => !!item.TemporaryId)
          .map((ele) => ele.Value)
          .join(',')
        if (!!removeGroup) {
          apiFetchDeleteYakScriptGroupLocal(removeGroup)
        }
      })
    }
  }, [])

  useEffect(() => {
    // 任务列表点击查看,需要根据后端返回的用户输入模块在页面上复现
    if (!initSelectGroupAll.length) return
    let groupObj: { selectGroupListByKeyWord: string[] } = {
      selectGroupListByKeyWord: [],
    }
    if (keyWordResponseToSelect.length > 0) {
      // 设置关键词组默认选中
      const initSelectGroup = keyWordResponseToSelect
        .filter((item) => initSelectGroupAll.includes(item.Value))
        .map((ele) => ele.Value)
      groupObj.selectGroupListByKeyWord = initSelectGroup
    }
    // 未被删除的组
    const haveGroup = groupObj.selectGroupListByKeyWord
    // 被删除的组
    const removeGroup = initSelectGroupAll.filter((item) => !haveGroup.includes(item))
    setPageInfo((v) => ({ ...v, ...groupObj }))
    setDeletedGroup(removeGroup)
    /**ANCHOR[id=deleted-init-group-all] - 清空初始查询回来的组 */
    setInitSelectGroupAll([])
  }, [initSelectGroupAll, keyWordResponseToSelect])

  const onSetSelectGroupListByKeyWord = useMemoizedFn((groups) => {
    setPageInfo((v) => ({ ...v, selectGroupListByKeyWord: groups }))
  })
  const selectGroupListAll = useCreation(() => {
    const groups = [...new Set([...(pageInfo.selectGroupListByKeyWord || []), ...(deletedGroup || [])])]
    return groups
  }, [pageInfo.selectGroupListByKeyWord, deletedGroup])
  const onClearAll = useMemoizedFn(() => {
    setPageInfo((v) => ({ ...v, selectGroup: [], selectGroupListByKeyWord: [] }))
    setDeletedGroup([])
    setHidden(false)
  })
  /**设置输入模块的初始值后，根据value刷新列表相关数据 */
  const onInitInputValueAfter = useMemoizedFn((value: HybridScanControlAfterRequest) => {
    try {
      const inputValue: YakPoCExecutorInputValueProps = hybridScanParamsConvertToInputValue(value)
      const { pluginInfo } = inputValue
      const group = pluginInfo.filters?.plugin_group?.map((ele) => ele.value) || []
      /**ANCHOR[id=set-init-group-all] - 设置该条记录的所有选中组 */
      setInitSelectGroupAll(group)
    } catch (error) {}
  })

  return (
    <div className={styles['yak-poc-wrapper']} ref={pluginGroupRef}>
      {isTaskDetail ? (
        <YakPoCExecuteContent
          hidden={hidden}
          setHidden={setHidden}
          selectGroupList={selectGroupListAll}
          executeStatus={executeStatus}
          setExecuteStatus={setExecuteStatus}
          onClearAll={onClearAll}
          pageId={pageId}
          pageInfo={pageInfo}
          onInitInputValueAfter={onInitInputValueAfter}
          setPluginExecuteLog={setPluginExecuteLog}
          isTaskDetail
        />
      ) : (
        <>
          <div className={styles['yak-poc-task-list-entry']}>
            <YakitButton onClick={() => setVisibleTaskList(true)}>{t('YakPoCExecuteContent.taskList')}</YakitButton>
          </div>
          <YakPoCExecuteContent
            hidden={hidden}
            setHidden={setHidden}
            selectGroupList={selectGroupListAll}
            executeStatus={executeStatus}
            setExecuteStatus={setExecuteStatus}
            onClearAll={onClearAll}
            pageId={pageId}
            pageInfo={pageInfo}
            onInitInputValueAfter={onInitInputValueAfter}
            setPluginExecuteLog={setPluginExecuteLog}
            groupListNode={
              <div className={styles['inline-plugin-group']}>
                <PluginGroupByKeyWord
                  pageId={pageId}
                  inViewport={inViewport}
                  hidden={false}
                  defGroupKeywords={pageInfo.defGroupKeywords || ''}
                  selectGroupListByKeyWord={pageInfo.selectGroupListByKeyWord || []}
                  setSelectGroupListByKeyWord={onSetSelectGroupListByKeyWord}
                  setResponseToSelect={setKeyWordResponseToSelect}
                />
              </div>
            }
          />
          <React.Suspense fallback={<>loading...</>}>
            {visibleTaskList && (
              <HybridScanTaskListDrawer
                visible={visibleTaskList}
                setVisible={setVisibleTaskList}
                hybridScanTaskSource="yakPoc"
              />
            )}
          </React.Suspense>
        </>
      )}
    </div>
  )
})

/**单分组内联插件列表（展开卡片时使用，只读展示该分组下的插件）*/
const PluginGroupPluginInline: React.FC<PluginGroupPluginInlineProps> = React.memo((props) => {
  const { t } = useI18nNamespaces(['yakPoC'])
  const { group } = props
  const isLoadingRef = useRef<boolean>(true)
  const [response, dispatch] = useReducer(pluginLocalReducer, initialLocalState)
  const [loading, setLoading] = useState<boolean>(false)
  const [hasMore, setHasMore] = useState<boolean>(true)
  /**已加载过且非空的分组缓存，避免重复请求 */
  const loadedGroupRef = useRef<string>('')

  const privateDomainRef = useRef<string>('') // 连接地址

  useEffect(() => {
    getPrivateDomainAndRefList()
  }, [])

  /**获取最新的私有域,并刷新列表 */
  const getPrivateDomainAndRefList = useMemoizedFn(() => {
    getRemoteValue(getRemoteHttpSettingGV()).then((setting) => {
      if (setting) {
        const values = JSON.parse(setting)
        privateDomainRef.current = values.BaseUrl
      }
    })
  })

  useEffect(() => {
    fetchList(true)
  }, [group])

  const fetchList = useDebounceFn(
    useMemoizedFn(async (reset?: boolean) => {
      if (!group) return
      if (reset) {
        isLoadingRef.current = true
      }
      setLoading(true)

      const params: PluginListPageMeta = !!reset
        ? { page: 1, limit: 20 }
        : {
            page: +response.Pagination.Page + 1,
            limit: +response.Pagination.Limit || 20,
          }
      const query: QueryYakScriptRequest = {
        IsMITMParamPlugins: 2,
        Pagination: {
          Limit: params?.limit || 10,
          Page: params?.page || 1,
          OrderBy: 'updated_at',
          Order: 'desc',
        },
      }
      query.Group = { UnSetGroup: false, Group: [group] }
      query.Type = batchPluginType
      try {
        const res = await apiQueryYakScript(query)
        if (!res.Data) res.Data = []
        const length = +res.Pagination.Page === 1 ? res.Data.length : res.Data.length + response.Data.length
        setHasMore(length < +res.Total)
        const newData = res.Data.map((ele) => ({
          ...ele,
          isLocalPlugin: privateDomainRef.current !== ele.OnlineBaseUrl,
        }))
        dispatch({
          type: 'add',
          payload: {
            response: {
              ...res,
              Data: newData,
            },
          },
        })
        if (+res.Pagination.Page === 1) {
          loadedGroupRef.current = group
        }
      } catch (error) {}
      setTimeout(() => {
        isLoadingRef.current = false
        setLoading(false)
      }, 200)
    }),
    { wait: 200, leading: true },
  ).run
  // 滚动更多加载
  const onUpdateList = useMemoizedFn(() => {
    fetchList()
  })
  /** 单项副标题组件 */
  const optExtra = useMemoizedFn((data: YakScript) => {
    if (privateDomainRef.current !== data.OnlineBaseUrl) return <></>
    if (data.OnlineIsPrivate) {
      return <SolidPrivatepluginIcon className="icon-svg-16" />
    } else {
      return <SolidCloudpluginIcon className="icon-svg-16" />
    }
  })
  return (
    <div className={styles['group-inline-list-wrapper']}>
      {+response.Total === 0 && !loading ? (
        <YakitEmpty title={t('YakitEmpty.noData')} style={{ padding: '24px 0' }} />
      ) : (
        <RollingLoadList<YakScript>
          data={response.Data}
          loadMoreData={onUpdateList}
          renderRow={(info: YakScript, i: number) => {
            return (
              <PluginDetailsListItem<YakScript>
                order={i}
                plugin={info}
                selectUUId={''} //本地用的ScriptName代替uuid
                check={false}
                headImg={info.HeadImg || ''}
                pluginUUId={info.ScriptName} //本地用的ScriptName代替uuid
                pluginName={info.ScriptName}
                help={info.Help}
                content={info.Content}
                optCheck={() => {}}
                official={!!info.OnlineOfficial}
                isCorePlugin={!!info.IsCorePlugin}
                pluginType={info.Type}
                onPluginClick={() => {}}
                extra={optExtra}
                enableClick={false}
                enableCheck={false}
                hideHeadImg
                hideHelpIcon
                hideSourceIcon
              />
            )
          }}
          page={response.Pagination.Page}
          hasMore={hasMore}
          loading={loading}
          defItemHeight={46}
          rowKey="ScriptName"
          isRef={loading && isLoadingRef.current}
          classNameRow="plugin-details-opt-wrapper"
          classNameList={styles['group-inline-list-inner']}
        />
      )}
    </div>
  )
})

const PluginGroupByKeyWord: React.FC<PluginGroupByKeyWordProps> = React.memo((props) => {
  const { t } = useI18nNamespaces(['yakPoC', 'yakitUi'])
  const { pageId, hidden, inViewport, setResponseToSelect, defGroupKeywords } = props
  const [selectGroupList, setSelectGroupList] = useControllableValue<string[]>(props, {
    defaultValue: [],
    valuePropName: 'selectGroupListByKeyWord',
    trigger: 'setSelectGroupListByKeyWord',
  })

  const [loading, setLoading] = useState<boolean>(false)
  const [response, setResponse] = useState<GroupCount[]>([])
  const [visibleOnline, setVisibleOnline] = useState<boolean>(false)
  /**已展开内联插件列表的分组（可多个同时展开）*/
  const [expandedGroups, setExpandedGroups] = useState<string[]>([])

  const initialResponseRef = useRef<GroupCount[]>([])
  useEffect(() => {
    if (!defGroupKeywords) return
    onSearch(defGroupKeywords)
  }, [defGroupKeywords])

  useEffect(() => {
    if (inViewport) init()
  }, [inViewport])

  const init = useMemoizedFn(() => {
    setLoading(true)
    getQueryYakScriptGroup()
      .then((res) => {
        initialResponseRef.current = res
        setResponseToSelect(res)
        if (response.length === 0) {
          setResponse(res)
        }
      })
      .finally(() =>
        setTimeout(() => {
          setLoading(false)
        }, 200),
      )
  })
  const getQueryYakScriptGroup: () => Promise<GroupCount[]> = useMemoizedFn(() => {
    return new Promise((resolve, reject) => {
      apiFetchQueryYakScriptGroupLocalByPoc({ PageId: pageId }).then(resolve).catch(reject)
    })
  })
  const onSelect = useMemoizedFn((val: GroupCount) => {
    const isExist = selectGroupList.includes(val.Value)
    if (isExist) {
      const newList = selectGroupList.filter((ele) => ele !== val.Value)
      setSelectGroupList(newList)
    } else {
      const newList = [...selectGroupList, val.Value]
      setSelectGroupList(newList)
    }
    onSearch('')
  })
  const onToggleExpand = useMemoizedFn((value: string) => {
    setExpandedGroups((list) => (list.includes(value) ? list.filter((ele) => ele !== value) : [...list, value]))
  })
  const onSearch = useMemoizedFn((val) => {
    if (!val) {
      setResponse(initialResponseRef.current)
      return
    }

    const isHaveData = initialResponseRef.current.filter((ele) => {
      return ele.Value.toUpperCase() === val.toUpperCase()
    })
    if (isHaveData.length > 0) {
      setResponse([...isHaveData])
    } else {
      // 先创建临时分组再搜索
      const addParams: SaveYakScriptGroupRequest = {
        SaveGroup: [val],
        Filter: {
          // 该参数的page，limit无效
          Pagination: {
            Page: 1,
            Limit: 1,
            Order: '',
            OrderBy: '',
          },
          Keyword: val,
          Type: 'mitm,port-scan,nuclei',
        },
        RemoveGroup: [],
        PageId: pageId,
      }
      setLoading(true)
      apiFetchSaveYakScriptGroupLocal(addParams)
        .then(getQueryYakScriptGroup)
        .then((res) => {
          const searchData = res.filter((ele) => {
            return ele.Value.toUpperCase().includes(val.toUpperCase())
          })
          initialResponseRef.current = res
          setResponse([...searchData])
        })
        .finally(() =>
          setTimeout(() => {
            setLoading(false)
          }, 200),
        )
    }
  })
  return (
    <div
      className={classNames(styles['plugin-group-wrapper'], {
        [styles['plugin-group-wrapper-hidden']]: hidden,
      })}
    >
      {initialResponseRef.current.length === 0 ? (
        <div className={styles['yak-poc-empty']}>
          <YakitEmpty
            title={t('YakitEmpty.noData')}
            description={t('PluginGroupByKeyWord.noDataDesc', { edition: getReleaseEditionName() })}
          />
          <div className={styles['yak-poc-buttons']}>
            <YakitButton type="outline1" icon={<CloudDownloadIcon />} onClick={() => setVisibleOnline(true)}>
              {t('YakitButton.oneClickDownload')}
            </YakitButton>
          </div>
        </div>
      ) : (
        <div className={styles['group-list-flex']}>
          {response.map((rowData: GroupCount) => {
            const checked = selectGroupList.includes(rowData.Value)
            const expanded = expandedGroups.includes(rowData.Value)
            return (
              <PluginGroupByKeyWordItem
                key={rowData.Value}
                item={rowData}
                onSelect={onSelect}
                selected={checked}
                expanded={expanded}
                onToggleExpand={onToggleExpand}
              />
            )
          })}
        </div>
      )}
      <YakitGetOnlinePlugin
        visible={visibleOnline}
        setVisible={(v) => {
          setVisibleOnline(v)
          setTimeout(() => {
            init()
          }, 200)
        }}
        listType="online"
        getContainer={document.getElementById(`main-operator-page-body-${YakitRoute.PoC}`) || undefined}
      />
    </div>
  )
})

const PluginGroupByKeyWordItem: React.FC<PluginGroupByKeyWordItemProps> = React.memo((props) => {
  const { t } = useI18nNamespaces(['yakPoC'])
  const { item, onSelect, selected, expanded, onToggleExpand } = props
  return (
    <div
      className={classNames(styles['group-item-wrapper'], styles['group-keyword-item-wrapper'], {
        [styles['group-item-wrapper-checked']]: selected,
        [styles['group-item-wrapper-expanded']]: expanded,
      })}
    >
      <div className={styles['group-card-header']}>
        <YakitCheckbox checked={selected} onClick={(e) => e.stopPropagation()} onChange={() => onSelect(item)} />
        <span
          className={classNames(styles['item-tip-name'], 'yakit-content-single-ellipsis')}
          title={item.Value}
          onClick={() => onToggleExpand(item.Value)}
        >
          {item.Value}
        </span>
        <span className={styles['item-tip-number']}>
          {item.Total}
          {t('PluginGroupByKeyWordItem.plugins')}
        </span>
        <YakitButton
          type="text2"
          className={styles['group-card-expand-btn']}
          onClick={(e) => {
            e.stopPropagation()
            onToggleExpand(item.Value)
          }}
        >
          {expanded ? <OutlineArrowscollapseIcon /> : <OutlineArrowsexpandIcon />}
          <span className={styles['group-card-expand-text']}>{expanded ? '收起' : '展开'}</span>
        </YakitButton>
      </div>
      {expanded && (
        <div className={styles['group-card-body']}>
          <PluginGroupPluginInline group={item.Value} />
        </div>
      )}
    </div>
  )
})
const YakPoCExecuteContent: React.FC<YakPoCExecuteContentProps> = React.memo((props) => {
  const { t } = useI18nNamespaces(['yakPoC', 'yakitUi'])
  const { selectGroupList, pageId, pageInfo, onInitInputValueAfter, setPluginExecuteLog, groupListNode, isTaskDetail } =
    props
  const pluginBatchExecuteContentRef = useRef<HybridScanExecuteContentRefProps>(null)

  const [hidden, setHidden] = useControllableValue<boolean>(props, {
    defaultValue: false,
    valuePropName: 'hidden',
    trigger: 'setHidden',
  })

  /**是否展开/收起 */
  const [isExpand, setIsExpand] = useState<boolean>(true)
  const [, setProgressList] = useState<StreamResult.Progress[]>([])
  const [executeStatus, setExecuteStatus] = useControllableValue<ExpandAndRetractExcessiveState>(props, {
    defaultValue: 'default',
    valuePropName: 'executeStatus',
    trigger: 'setExecuteStatus',
  })
  /**暂停 */
  const [pauseLoading, setPauseLoading] = useState<boolean>(false)
  /**继续 */
  const [continueLoading, setContinueLoading] = useState<boolean>(false)
  useEffect(() => {
    if (pageInfo.runtimeId) {
      onActionHybridScanByRuntimeId(pageInfo.runtimeId)
    } else {
      /**不带runtimeId，但是带有一些表单的默认值，例如：【发送到漏洞检测】功能 */
      const defaultFormValue = pageInfo.formValue
      if (defaultFormValue && Object.keys(defaultFormValue).length > 0) {
        pluginBatchExecuteContentRef.current?.onInitInputValue(defaultFormValue)
      }
    }
  }, [])

  /** 通过runtimeId查询该条记录详情 */
  const onActionHybridScanByRuntimeId = useMemoizedFn((runtimeId: string) => {
    if (!runtimeId) return
    pluginBatchExecuteContentRef.current?.onActionHybridScanByRuntimeId(runtimeId, pageInfo.hybridScanMode).then(() => {
      setIsExpand(false)
    })
  })
  const selectGroupNum = useCreation(() => {
    return selectGroupList.length
  }, [selectGroupList])
  const pluginInfo = useCreation(() => {
    return {
      selectPluginName: [],
      filters: {
        plugin_type: batchPluginType.split(',').map((ele) => ({ value: ele, label: ele, count: 0 })),
        plugin_group: selectGroupList.map((ele) => ({ value: ele, label: ele, count: 0 })),
      },
    }
  }, [selectGroupList])

  const onSetExecuteStatus = useMemoizedFn((val) => {
    setExecuteStatus(val)
  })
  const dataScanParams = useCreation(() => {
    return {
      https: pageInfo.https,
      httpFlowIds: pageInfo.httpFlowIds,
      request: pageInfo.request,
    }
  }, [pageInfo.https, pageInfo.httpFlowIds, pageInfo.request])
  return (
    <>
      {isTaskDetail ? (
        <div className={styles['yak-poc-detail-wrapper']}>
          <HybridScanExecuteContent
            ref={pluginBatchExecuteContentRef}
            isExpand={false}
            setIsExpand={setIsExpand}
            onInitInputValueAfter={onInitInputValueAfter}
            selectNum={selectGroupNum}
            setProgressList={setProgressList}
            pauseLoading={pauseLoading}
            setPauseLoading={setPauseLoading}
            continueLoading={continueLoading}
            setContinueLoading={setContinueLoading}
            pluginInfo={pluginInfo}
            executeStatus={executeStatus}
            setExecuteStatus={onSetExecuteStatus}
            setPluginExecuteLog={setPluginExecuteLog}
            setHidden={setHidden}
            dataScanParams={dataScanParams}
            pageId={pageId}
            initRuntimeId={pageInfo.runtimeId}
            hybridScanTaskSource="yakPoc"
            hideExecuteForm
          />
        </div>
      ) : (
        <div className={styles['yak-poc-execute-wrapper']}>
          <div className={styles['yak-poc-executor-body']}>
            <div className={styles['yak-poc-executor-body-cont']}>
              <HybridScanExecuteContent
                ref={pluginBatchExecuteContentRef}
                isExpand={isExpand}
                setIsExpand={setIsExpand}
                onInitInputValueAfter={onInitInputValueAfter}
                selectNum={selectGroupNum}
                setProgressList={setProgressList}
                pauseLoading={pauseLoading}
                setPauseLoading={setPauseLoading}
                continueLoading={continueLoading}
                setContinueLoading={setContinueLoading}
                pluginInfo={pluginInfo}
                executeStatus={executeStatus}
                setExecuteStatus={onSetExecuteStatus}
                setPluginExecuteLog={setPluginExecuteLog}
                setHidden={setHidden}
                dataScanParams={dataScanParams}
                pageId={pageId}
                initRuntimeId={pageInfo.runtimeId}
                hybridScanTaskSource="yakPoc"
                showScanTargetHelp={false}
                extraFormNode={groupListNode}
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
})
/**
 * 计算两个时间戳的间隔
 * @param {number} startTime
 * @param {number} endTime
 * @returns {TimeConsumingProps}
 */
const intervalTime = (startTime: number, endTime: number, t: TFunction) => {
  const startMoment = moment(startTime)
  const endMoment = moment(endTime)

  // 计算时间差
  const duration = endMoment.diff(startMoment)

  // 使用duration的as方法获取分钟和秒数
  const durationObj = moment.duration(duration)
  const minutes = durationObj.minutes()
  const seconds = durationObj.seconds()
  if (minutes > 60) {
    return {
      type: 'danger',
      value: t('PluginExecuteLog.timeout'),
    }
  }
  if (minutes > 0) {
    return {
      type: 'info',
      value: `${minutes} min`,
    }
  }
  return {
    type: 'info',
    value: `${seconds} s`,
  }
}
export const PluginExecuteLog: React.FC<PluginExecuteLogProps> = React.memo((props) => {
  const { t } = useI18nNamespaces(['yakPoC'])
  const { hidden, pluginExecuteLog, isExecuting, classNameWrapper = '' } = props
  const [interval, setInterval] = useState<number | undefined>(1000)

  const [recalculation, setRecalculation] = useState<boolean>(false)
  const [data, setData] = useState<PluginLogProps[]>([])

  const clear = useInterval(() => {
    onHandleData()
  }, interval)
  useEffect(() => {
    if (hidden || !isExecuting) {
      setInterval(undefined)
    } else {
      setInterval(1000)
    }
    return () => {
      clear()
    }
  }, [hidden, isExecuting])

  const onHandleData = useMemoizedFn(() => {
    const logs: PluginLogProps[] = pluginExecuteLog
      .map((item) => {
        const newTime = Date.now()
        const timeConsuming: TimeConsumingProps = intervalTime(item.startTime, newTime, t)
        return { ...item, timeConsuming }
      })
      .sort((a, b) => compareAsc(a, b, 'Index'))
    setData(logs)
    setRecalculation(!recalculation)
  })

  return (
    <div
      className={classNames(
        styles['plugin-execute-log-wrapper'],
        {
          [styles['plugin-execute-log-wrapper-hidden']]: hidden,
        },
        classNameWrapper,
      )}
    >
      <YakitSpin spinning={isExecuting} size="small" style={{ alignItems: 'center', height: 20 }} />
      <RollingLoadList<PluginLogProps>
        data={data}
        loadMoreData={() => {}}
        renderRow={(i: PluginLogProps, index: number) => {
          const { value, type } = i.timeConsuming
          return (
            <>
              <span className={styles['name']}>
                {i.Index}: [{i.PluginName}]
              </span>
              <span className="content-ellipsis">
                {t('PluginExecuteLog.target')}: {i.Url}
              </span>
              <span
                className={classNames(styles['time'], {
                  [styles['time-danger']]: type === 'danger',
                })}
              >
                {type === 'danger' ? value : `${t('PluginExecuteLog.timeConsuming')}: ${value}`}
              </span>
            </>
          )
        }}
        page={1}
        hasMore={false}
        defItemHeight={108}
        rowKey="Index"
        recalculation={recalculation}
        loading={false}
        classNameList={styles['plugin-log-list']}
        classNameRow={styles['plugin-log-item']}
      />
    </div>
  )
})
