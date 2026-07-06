import React, { useState } from 'react'
import { ArtColumn, BaseTable, features, useTablePipeline } from '../../alibaba/ali-react-table-dist'
import { analyzeFuzzerResponse, FuzzerResponse } from './HTTPFuzzerPage'
import { formatTimestamp } from '../../utils/timeUtil'
import * as antd from 'antd'
import { EyeOutlined } from '@ant-design/icons'
import { StatusCodeToColor } from '../../components/HTTPFlowTable/HTTPFlowTable'
import { CopyableField } from '../../utils/inputUtil'
import ReactResizeDetector from 'react-resize-detector'
import { useMemoizedFn } from 'ahooks'
import { YakitButton } from '@/components/yakitUI/YakitButton/YakitButton'
import { useI18nNamespaces } from '@/i18n/useI18nNamespaces'

export interface FuzzerResponseTableProp {
  content: FuzzerResponse[]
  setRequest: (s: string | any) => any
  success?: boolean
  onSendToWebFuzzer?: (isHttps: boolean, request: string) => any
  sendToPlugin?: (request: Uint8Array, isHTTPS: boolean, response?: Uint8Array) => any
}

const sortAsNumber = (a: any, b: any) => (parseInt(a) > parseInt(b) ? 1 : -1)

export const FuzzerResponseTableEx: React.FC<FuzzerResponseTableProp> = React.memo((props) => {
  const { content, setRequest } = props
  const { t, i18n } = useI18nNamespaces(['webFuzzer', 'yakitUi'])
  const [tableHeight, setTableHeight] = useState(0)

  const successResponseOperationHandler = useMemoizedFn((v: any, _, index: number) => {
    return (
      <YakitButton
        type="text"
        size="small"
        icon={<EyeOutlined />}
        onClick={() => {
          const res = content.filter((i) => i.UUID === v)
          if ((res || []).length > 0) {
            analyzeFuzzerResponse(res[0], index, content)
          }
        }}
      >
        {t('YakitButton.detail')}
      </YakitButton>
    )
  })

  const getArtColumns = useMemoizedFn((): ArtColumn[] => {
    if (!props.success) {
      return [
        {
          name: 'Method',
          code: 'Method',
          width: 60,
          features: {
            sortable: true,
          },
        },
        {
          name: t('FuzzerResponseTableEx.failureReason'),
          code: 'Reason',
          render: (v) => {
            return v ? (
              <CopyableField style={{ color: 'var(--Colors-Use-Error-Primary)' }} noCopy={true} text={v} />
            ) : (
              '-'
            )
          },
          features: {
            tips: <>{t('FuzzerResponseTableEx.failureContentNotice')}</>,
          },
        },
        {
          name: 'Payloads',
          code: 'Payloads',
          render: (value: any, row: any, rowIndex: number) => {
            return <>{`${value}`}</>
          },
          width: 240,
        },
      ]
    }

    // 请求元信息：状态码 → 方法 → 序号
    const requestGroup: ArtColumn[] = [
      {
        name: 'StatusCode',
        code: 'StatusCode',
        features: {
          sortable: sortAsNumber,
        },
        render: (v) => <div style={{ color: StatusCodeToColor(v) }}>{`${v}`}</div>,
        width: 100,
      },
      {
        name: 'Method',
        code: 'Method',
        width: 100,
        features: {
          sortable: true,
        },
      },
      {
        name: t('FuzzerResponseTableEx.request'),
        code: 'Count',
        features: {
          sortable: sortAsNumber,
        },
        width: 70,
      },
    ]

    // 报文体征：Payload / 体积 / 耗时 / 类型
    const payloadGroup: ArtColumn[] = [
      {
        name: 'Payloads',
        code: 'Payloads',
        render: (value: any, row: any, rowIndex: number) => {
          return `${value}`
        },
        width: 300,
      },
      {
        name: t('FuzzerResponseTableEx.responseSize'),
        code: 'BodyLength',
        render: (v) => v,
        features: {
          sortable: sortAsNumber,
        },
        width: 100,
      },
      {
        name: t('FuzzerResponseTableEx.latencyMs'),
        code: 'DurationMs',
        render: (value: any, row: any, rowIndex: number) => {
          return value
        },
        width: 100,
        features: {
          sortable: sortAsNumber,
        },
      },
      {
        name: 'Content-Type',
        code: 'ContentType',
        render: (value: any, row: any, rowIndex: number) => {
          return value
        },
        width: 300,
      },
    ]

    // 相似度指标
    const similarityGroup: ArtColumn[] = [
      {
        name: t('FuzzerResponseTableEx.responseSimilarity'),
        code: 'BodySimilarity',
        render: (v) => {
          const text = parseFloat(`${v}`).toFixed(3)
          return (
            <div style={{ color: text.startsWith('1.00') ? 'var(--Colors-Use-Success-Primary)' : undefined }}>
              {text}
            </div>
          )
        },
        features: {
          sortable: sortAsNumber,
        },
        width: 100,
      },
      {
        name: t('FuzzerResponseTableEx.httpHeaderSimilarity'),
        code: 'HeaderSimilarity',
        render: (v) => parseFloat(`${v}`).toFixed(3),
        features: {
          sortable: sortAsNumber,
        },
        width: 100,
      },
    ]

    const trailingGroup: ArtColumn[] = [
      {
        name: 'time',
        code: 'Timestamp',
        features: {
          sortable: sortAsNumber,
        },
        render: (v) => `${formatTimestamp(v)}`,
        width: 165,
      },
      {
        name: t('YakitTable.action'),
        code: 'UUID',
        render: successResponseOperationHandler,
        width: 80,
        lock: true,
      },
    ]

    return [...requestGroup, ...payloadGroup, ...similarityGroup, ...trailingGroup]
  })

  const pipeline = useTablePipeline({
    components: antd,
    primaryKey: (raw: FuzzerResponse) => {
      return raw.UUID
    },
  })
    .input({
      dataSource: content,
      columns: getArtColumns(),
    })
    .primaryKey('UUID')
    .use(
      features.columnResize({
        minSize: 60,
      }),
    )
    .use(
      features.sort({
        mode: 'single',
        highlightColumnWhenActive: true,
      }),
    )
    .use(features.columnHover())
    .use(features.tips())

  return (
    <section className="sentinel-fuzzer-response-table" style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
      <ReactResizeDetector
        onResize={(width, height) => {
          if (!width || !height) {
            return
          }
          setTableHeight(height)
        }}
        handleWidth={true}
        handleHeight={true}
        refreshMode={'debounce'}
        refreshRate={50}
      />
      <BaseTable {...pipeline.getProps()} style={{ width: '100%', height: tableHeight, overflow: 'auto' }} />
    </section>
  )
})
