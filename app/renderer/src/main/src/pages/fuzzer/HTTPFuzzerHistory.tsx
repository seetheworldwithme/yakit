import React, { useEffect, useMemo, useState } from 'react'
import { List } from 'antd'
import { formatTimestamp } from '../../utils/timeUtil'
import { ReloadOutlined, DeleteOutlined } from '@ant-design/icons'
import { useMemoizedFn } from 'ahooks'
import { info } from '../../utils/notification'
import { PaginationSchema } from '@/pages/invoker/schema'
import { HistoryHTTPFuzzerTask } from '@/pages/fuzzer/HTTPFuzzerPage'
import { Uint8ArrayToString } from '@/utils/str'
import { NewHTTPPacketEditor } from '@/utils/editors'
import { CheckIcon } from '@/assets/newIcon'
import styles from './HTTPFuzzerHistory.module.scss'
import { YakitButton } from '@/components/yakitUI/YakitButton/YakitButton'
import { YakitInput } from '@/components/yakitUI/YakitInput/YakitInput'
import { YakitPopover } from '@/components/yakitUI/YakitPopover/YakitPopover'
import { YakitTag } from '@/components/yakitUI/YakitTag/YakitTag'
import { YakitPopconfirm } from '@/components/yakitUI/YakitPopconfirm/YakitPopconfirm'
import { YakitSwitch } from '@/components/yakitUI/YakitSwitch/YakitSwitch'
import { DeleteFuzzerConfigRequest, apiDeleteFuzzerConfig } from '../layout/mainOperatorContent/utils'
import { YakitCard } from '@/components/yakitUI/YakitCard/YakitCard'
import { useI18nNamespaces } from '@/i18n/useI18nNamespaces'

export interface HTTPFuzzerHistorySelectorProp {
  currentSelectId?: number
  onSelect: (i: number, page: number, showAll: boolean) => any
  onDeleteAllCallback: () => void
  fuzzerTabIndex: string
}

const { ipcRenderer } = window.require('electron')

interface HTTPFuzzerTask {
  Id: number
  CreatedAt: number
  HTTPFlowTotal: number
  HTTPFlowSuccessCount: number
  HTTPFlowFailedCount: number
  Host?: string
  Port?: number
  onReload?: () => any
}

export interface HTTPFuzzerTaskDetail {
  BasicInfo: HTTPFuzzerTask
  OriginRequest: HistoryHTTPFuzzerTask
}

/*
* message HistoryHTTPFuzzerTaskDetail {
  HistoryHTTPFuzzerTask BasicInfo = 1;
  FuzzerRequest OriginRequest = 2;
}
* */

export const HTTPFuzzerHistorySelector: React.FC<HTTPFuzzerHistorySelectorProp> = React.memo((props) => {
  const { currentSelectId, fuzzerTabIndex } = props
  const { t, i18n } = useI18nNamespaces(['webFuzzer', 'yakitUi'])
  const [tasks, setTasks] = useState<HTTPFuzzerTaskDetail[]>([])
  const [loading, setLoading] = useState(false)
  const [paging, setPaging] = useState<PaginationSchema>({ Limit: 10, Order: '', OrderBy: '', Page: 1 })
  const [keyword, setKeyword] = useState('')
  const [total, setTotal] = useState(0)
  const [showAll, setShowAll] = useState<boolean>(false)
  const page = useMemo(() => paging.Page, [paging.Page])
  const limit = useMemo(() => paging.Limit, [paging.Limit])
  useEffect(() => {
    reload(1, limit, true)
  }, [])
  const deleteAll = useMemoizedFn(() => {
    setLoading(true)
    const removeParams = {
      WebFuzzerIndex: showAll ? '' : fuzzerTabIndex,
    }
    ipcRenderer
      .invoke('DeleteHistoryHTTPFuzzerTask', removeParams)
      .then(() => {
        info('Delete History')
        deleteFuzzerConfig()
        reload(1, limit)
        props.onDeleteAllCallback()
      })
      .finally(() => setTimeout(() => setLoading(false), 300))
  })
  /**删除 对应的配置缓存历史数据 */
  const deleteFuzzerConfig = useMemoizedFn(() => {
    let deleteFuzzerConfigRequest: DeleteFuzzerConfigRequest = {
      PageId: [],
      DeleteAll: false,
    }
    if (showAll) {
      deleteFuzzerConfigRequest.DeleteAll = true
    } else {
      deleteFuzzerConfigRequest.PageId = [fuzzerTabIndex]
    }
    apiDeleteFuzzerConfig(deleteFuzzerConfigRequest)
  })

  const reload = useMemoizedFn((pageInt: number, limitInt: number, first?: boolean) => {
    setLoading(true)
    const params = {
      Pagination: { ...paging, Page: pageInt, Limit: limitInt },
      Keyword: keyword,
      FuzzerTabIndex: showAll ? '' : fuzzerTabIndex,
    }
    ipcRenderer
      .invoke('QueryHistoryHTTPFuzzerTaskEx', params)
      .then((data: { Data: HTTPFuzzerTaskDetail[]; Total: number; Pagination: PaginationSchema }) => {
        setTasks(data.Data)
        setTotal(data.Total)
        setPaging(data.Pagination)
        if (data.Total == 0 && first) {
          onSwitchShowAll(true)
        }
      })
      .finally(() => setTimeout(() => setLoading(false), 300))
  })

  const onSwitchShowAll = useMemoizedFn((v) => {
    setShowAll(v)
    setTimeout(() => {
      reload(1, limit)
    }, 200)
  })

  return (
    <YakitCard
      bordered={false}
      className={styles['history-panel']}
      title={
        <header className={styles['history-head']}>
          <span className={styles['history-head-title']}>Web Fuzzer History</span>
          <div className={styles['history-head-tools']}>
            <YakitButton
              type="text"
              size={'small'}
              icon={<ReloadOutlined />}
              onClick={(e) => {
                reload(1, limit)
              }}
            />
            <YakitPopconfirm
              title={t('HTTPFuzzerHistorySelector.confirmDeletePackets')}
              onConfirm={() => {
                deleteAll()
              }}
            >
              <YakitButton type="text" size={'small'} colors="danger" icon={<DeleteOutlined />} />
            </YakitPopconfirm>
          </div>
        </header>
      }
    >
      <section className={styles['history-filter']}>
        <label className={styles['history-filter-search']}>
          <span className={styles['history-filter-label']}>{t('HTTPFuzzerHistorySelector.quickSearch')}</span>
          <YakitInput.Search
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onSearch={() => reload(1, limit)}
            onPressEnter={() => reload(1, limit)}
          />
        </label>
        <label className={styles['history-filter-toggle']}>
          <span>{t('YakitButton.view_all_button')}</span>
          <YakitSwitch checked={showAll} onChange={onSwitchShowAll} />
        </label>
      </section>
      <List<HTTPFuzzerTaskDetail>
        className={`${styles['history-list']} yakit-list`}
        loading={loading}
        dataSource={tasks}
        pagination={{
          size: 'small',
          pageSize: limit,
          showSizeChanger: true,
          total,
          pageSizeOptions: ['5', '10', '20'],
          onChange: (page: number, limit?: number) => {
            reload(page, limit || 10)
          },
          onShowSizeChange: (old, limit) => {
            reload(page, limit || 10)
          },
        }}
        renderItem={(detail: HTTPFuzzerTaskDetail, index: number) => {
          const i = detail.BasicInfo
          let verbose = detail.OriginRequest.Verbose
          if (!verbose) {
            const rawToStr = Uint8ArrayToString(detail.OriginRequest.RequestRaw)
            if (!rawToStr) {
              verbose = detail.OriginRequest.Request
            } else {
              verbose = rawToStr
            }
          }
          const host = !!i.Host ? i.Host : formatTimestamp(i.CreatedAt)
          const ok = i.HTTPFlowSuccessCount === i.HTTPFlowTotal
          return (
            <List.Item key={i.Id} className={styles['history-row-item']}>
              <YakitPopover
                placement={'rightBottom'}
                content={
                  <div style={{ width: 600, height: 300 }}>
                    <NewHTTPPacketEditor
                      originValue={verbose}
                      readOnly={true}
                      noMinimap={true}
                      noHeader={true}
                      onlyBasicMenu={true}
                    />
                  </div>
                }
              >
                <article
                  className={styles['history-row']}
                  data-active={currentSelectId == i.Id ? 'true' : 'false'}
                  onClick={(e) => {
                    e.preventDefault()
                    const page = (paging.Page - 1) * 10 + index + 1
                    props.onSelect(i.Id, page, showAll)
                  }}
                >
                  <span className={styles['history-row-status']} data-ok={ok ? 'true' : 'false'} />
                  <main className={styles['history-row-main']}>
                    <div className={styles['history-row-host']} title={host}>
                      {host}
                    </div>
                    <div className={styles['history-row-meta']}>
                      <span className={styles['history-row-id']}>#{i.Id}</span>
                      <YakitTag color="info">
                        {t('HTTPFuzzerHistorySelector.totalFlows', {
                          HTTPFlowTotal: i.HTTPFlowTotal,
                        })}
                      </YakitTag>
                      {i.HTTPFlowSuccessCount != i.HTTPFlowTotal && (
                        <YakitTag>
                          {t('HTTPFuzzerHistorySelector.successCount', {
                            HTTPFlowSuccessCount: i.HTTPFlowSuccessCount,
                          })}
                        </YakitTag>
                      )}
                    </div>
                  </main>
                  {currentSelectId == i.Id && <CheckIcon className={styles['history-row-check']} />}
                </article>
              </YakitPopover>
            </List.Item>
          )
        }}
      />
    </YakitCard>
  )
})
