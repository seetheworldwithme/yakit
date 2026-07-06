import React, { useEffect, useMemo, useState } from 'react'
import { Empty, Radio } from 'antd'
import { FuzzerResponse } from './HTTPFuzzerPage'
import { FuzzerResponseTableEx } from './FuzzerResponseTable'
import { AutoCard } from '../../components/AutoCard'
import classNames from 'classnames'
import styles from './HTTPFuzzerResultsCard.module.scss'

export interface HTTPFuzzerResultsCardProp {
  extra?: React.ReactNode
  successResponses: FuzzerResponse[]
  failedResponses: FuzzerResponse[]
  setRequest?: (s: string) => any
  onSendToWebFuzzer?: (isHttps: boolean, request: string) => any
  sendToPlugin?: (request: Uint8Array, isHTTPS: boolean, response?: Uint8Array) => any
  showSuccess: boolean
  setShowSuccess: (b: boolean) => void
  showStatusSwitch?: boolean
}

type ResultsViewMode = 'grid' | 'table'

const isOk = (r: FuzzerResponse) => !!r.Ok
const briefBody = (r: FuzzerResponse): string => {
  const raw = r.ResponseRaw
  if (!raw || raw.length === 0) return ''
  try {
    const text = typeof raw === 'string' ? raw : new TextDecoder().decode(raw)
    const idx = text.indexOf('\r\n\r\n')
    const body = idx >= 0 ? text.slice(idx + 4) : text
    return body.slice(0, 140)
  } catch {
    return ''
  }
}

export const HTTPFuzzerResultsCard: React.FC<HTTPFuzzerResultsCardProp> = (props) => {
  // const [showSuccess, setShowSuccess] = useState(true);
  const { showSuccess, setShowSuccess, showStatusSwitch = true } = props
  const [loading, setLoading] = useState(false)
  const [viewMode, setViewMode] = useState<ResultsViewMode>('grid')

  useEffect(() => {
    setLoading(true)
    setTimeout(() => setLoading(false), 500)
  }, [])

  const responses = useMemo<FuzzerResponse[]>(() => {
    return showSuccess ? props.successResponses : props.failedResponses
  }, [showSuccess, props.successResponses, props.failedResponses])

  return (
    <AutoCard
      size={'small'}
      style={{ height: '100%' }}
      className={classNames('flex-card', styles['fuzzer-results-card'])}
      extra={
        <section className={styles['fuzzer-results-extra']}>
          {showStatusSwitch && (
            <Radio.Group value={showSuccess} onChange={(e) => setShowSuccess(e.target.value)} size="small">
              <Radio.Button value={true}>OK</Radio.Button>
              <Radio.Button value={false}>Err</Radio.Button>
            </Radio.Group>
          )}
          <Radio.Group value={viewMode} onChange={(e) => setViewMode(e.target.value)} size="small">
            <Radio.Button value="grid">Grid</Radio.Button>
            <Radio.Button value="table">Detail</Radio.Button>
          </Radio.Group>
          {props.extra}
        </section>
      }
      bodyStyle={{ padding: 0, width: '100%', overflow: 'hidden' }}
      bordered={false}
    >
      <section className={styles['fuzzer-results-body']}>
        {loading && <AutoCard loading={true} />}
        {!loading && viewMode === 'table' && (
          <FuzzerResponseTableEx
            onSendToWebFuzzer={props.onSendToWebFuzzer}
            sendToPlugin={props.sendToPlugin}
            success={showSuccess}
            setRequest={(s) => {
              props.setRequest && props.setRequest(s)
            }}
            content={responses}
          />
        )}
        {!loading && viewMode === 'grid' && (
          <>
            {responses.length === 0 ? (
              <Empty description="No Data" />
            ) : (
              <ul className={styles['fuzzer-results-grid']}>
                {responses.map((r, idx) => (
                  <li
                    key={r.UUID || idx}
                    className={classNames(styles['fuzzer-results-grid-item'], {
                      [styles['fuzzer-results-grid-item-ok']]: isOk(r),
                      [styles['fuzzer-results-grid-item-err']]: !isOk(r),
                    })}
                    onClick={() => {
                      const raw = new Buffer(r.RequestRaw || []).toString('utf8')
                      if (raw) props.setRequest && props.setRequest(raw)
                    }}
                  >
                    <header className={styles['fuzzer-results-grid-item-head']}>
                      <span className={styles['fuzzer-results-grid-item-status']}>
                        {r.StatusCode || (isOk(r) ? 'OK' : 'Err')}
                      </span>
                      <span className={styles['fuzzer-results-grid-item-host']}>{r.Host || ''}</span>
                    </header>
                    <p className={styles['fuzzer-results-grid-item-body']}>{briefBody(r) || '-'}</p>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>
    </AutoCard>
  )
}
