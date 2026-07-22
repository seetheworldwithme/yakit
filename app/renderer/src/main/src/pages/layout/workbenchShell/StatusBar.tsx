import React from 'react'
import './StatusBar.scss'

// 底部状态栏（原版无，是新版差异化性状）：引擎 / 代理 / 任务计数 占位
export const StatusBar: React.FC = React.memo(() => {
  return (
    <footer className="wb-statusbar">
      <span className="wb-status-item">引擎就绪</span>
      <span className="wb-status-sep">·</span>
      <span className="wb-status-item">代理 127.0.0.1:8083</span>
      {/* 已隐藏：状态栏品牌字「深蓝工作台」，如需恢复取消注释即可
      <span className="wb-status-brand">深蓝工作台</span>
      */}
    </footer>
  )
})
