import React from 'react'
import { Skeleton } from 'antd'
import styles from './SentinelStreamSkeleton.module.scss'

export type SentinelStreamSkeletonMode = 'page' | 'card' | 'content'

export interface SentinelStreamSkeletonProps {
  /** page: 整页；card: 任务卡片 + 消息列表；content: 仅消息列表 */
  mode?: SentinelStreamSkeletonMode
  rows?: number
}

/** 单条消息占位：圆点头 + 标题 + 两行正文 */
const ChatBubbleShimmer: React.FC = () => (
  <div className={styles['chat-bubble']}>
    <Skeleton active avatar={{ size: 16, shape: 'circle' }} title={{ width: '36%' }} paragraph={{ rows: 2, width: ['92%', '64%'] }} />
  </div>
)

/** 渲染多行消息占位 */
const renderBubbles = (rows: number) => (
  <div className={styles['chat-thread']}>
    {Array.from({ length: rows }).map((_item, idx) => (
      <ChatBubbleShimmer key={idx} />
    ))}
  </div>
)

/** 任务卡片占位：头部 + 目标行 + 消息列表容器 */
const TaskPanelShimmer: React.FC<{ rows: number }> = ({ rows }) => (
  <section className={styles.panel}>
    <Skeleton active avatar={{ size: 16, shape: 'circle' }} title={{ width: '30%' }} paragraph={false} />
    <Skeleton active title={false} paragraph={{ rows: 1, width: '72%' }} className={styles.objective} />
    <div className={styles['thread-window']}>{renderBubbles(rows)}</div>
  </section>
)

/**
 * Sentinel 流式面板骨架屏，按 mode 切换三种粒度：
 * page（整页）/ card（任务卡片 + 消息列表）/ content（仅消息列表）。
 */
const SentinelStreamSkeleton: React.FC<SentinelStreamSkeletonProps> = ({ mode = 'page', rows = 3 }) => {
  if (mode === 'content') {
    return <div className={styles['content-only']}>{renderBubbles(rows)}</div>
  }
  if (mode === 'card') {
    return <TaskPanelShimmer rows={rows} />
  }
  return (
    <div className={styles.page}>
      <div className={styles.divider} />
      <div className={styles.wrapper}>
        <TaskPanelShimmer rows={rows} />
      </div>
    </div>
  )
}

export default SentinelStreamSkeleton
