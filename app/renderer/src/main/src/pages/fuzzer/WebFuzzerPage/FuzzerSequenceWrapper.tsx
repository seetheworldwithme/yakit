import React from 'react'
import { FuzzerSequenceWrapperProps, WebFuzzerType } from './WebFuzzerPageType'
import styles from './WebFuzzerPage.module.scss'
import classNames from 'classnames'
import { useMemoizedFn } from 'ahooks'
import emiter from '@/utils/eventBus/eventBus'
import { webFuzzerTabs } from './WebFuzzerPage'
import { useI18nNamespaces } from '@/i18n/useI18nNamespaces'

/**只包裹序列 */
const FuzzerSequenceWrapper: React.FC<FuzzerSequenceWrapperProps> = React.memo(({ type, children }) => {
  const { t, i18n } = useI18nNamespaces(['webFuzzer'])
  /**点击切换tab，带其他操作 */
  const onSetType = useMemoizedFn((key: WebFuzzerType) => {
    emiter.emit('sendSwitchSequenceToMainOperatorContent', JSON.stringify({ type: key }))
    emiter.emit('sequenceOrCodeSendSwitchTypeToFuzzer', JSON.stringify({ type: key }))
  })
  return (
    <div className={styles['web-fuzzer']}>
      {/* 按功能裁剪方案：隐藏整个子 tab 栏（配置/规则/序列/热加载/AI）
          规则/序列/热加载/组并发均已无需求对应，仅保留「配置」内容区；恢复请取消本注释
      <div className={styles['web-fuzzer-tab']}>
        {webFuzzerTabs(t).map((item) => (
          <div
            key={item.key}
            className={classNames(styles['web-fuzzer-tab-item'], {
              [styles['web-fuzzer-tab-item-active-sequence']]: item.key === type,
            })}
            onClick={() => {
              const keyType = item.key as WebFuzzerType
              onSetType(keyType)
            }}
          >
            <span className={styles['web-fuzzer-tab-label']}>{item.label}</span>
          </div>
        ))}
      </div>
      */}
      <div className={classNames(styles['web-fuzzer-tab-content'])}>{children}</div>
    </div>
  )
})

export default FuzzerSequenceWrapper
