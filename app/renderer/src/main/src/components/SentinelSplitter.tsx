import { useMemoizedFn } from 'ahooks'
import React, { useEffect, useRef } from 'react'

import './SentinelSplitter.css'

/** 把 "100px" / 100 / "100" 统一成数字像素值，非法时回退到兜底值 */
const parsePixelValue = (raw: string | number | undefined, fallback: number): number => {
  if (raw === undefined || raw === null) return fallback
  const digits = Number(raw.toString().replace(/px$/i, ''))
  return Number.isFinite(digits) && digits > 0 ? digits : fallback
}

export interface SentinelSplitterProps {
  /** 纵向（上下）分割；默认横向（左右） */
  isVer?: boolean
  minSize?: string | number
  maxSize?: string | number
  bodyRef: any
  resizeRef: any
  onStart?: () => void
  onEnd?: () => void
  onChangeSize: (distance: number) => void
}

export const SentinelSplitter: React.FC<SentinelSplitterProps> = (props) => {
  const { isVer = false, minSize, maxSize, bodyRef, resizeRef, onStart, onEnd, onChangeSize } = props
  const lineRef = useRef<HTMLDivElement | null>(null)
  const axisRef = useRef<boolean>(isVer)

  useEffect(() => {
    axisRef.current = isVer
  }, [isVer])

  const readAxis = useMemoizedFn(() => axisRef.current)

  useEffect(() => {
    const body = bodyRef?.current as HTMLDivElement | undefined
    const resize = resizeRef?.current as HTMLDivElement | undefined
    const line = lineRef.current
    if (!body || !resize || !line) return

    const lower = parsePixelValue(minSize, 100)
    const upper = parsePixelValue(maxSize, 100)

    const teardown = () => {
      body.onmousemove = null
      document.onmouseup = null
    }

    const beginDrag = (downEvent: MouseEvent) => {
      if (onStart) onStart()
      const vertical = readAxis()
      const origin = vertical ? downEvent.layerY : downEvent.layerX
      const firstPos = vertical ? downEvent.clientY : downEvent.clientX
      line.style[vertical ? 'top' : 'left'] = `${origin}px`
      line.style.display = 'inline-block'
      let active = true

      body.onmousemove = (moveEvent: MouseEvent) => {
        const ver = readAxis()
        const rect = body.getBoundingClientRect()
        const before = ver ? moveEvent.clientY - rect.top : moveEvent.clientX - rect.left
        const after = ver
          ? body.clientHeight - moveEvent.clientY + rect.top
          : body.clientWidth - moveEvent.clientX + rect.left
        // 越过最小/最大边界则不再跟随，避免拖出可拖拽区
        if (before <= lower || after <= upper) return
        const current = ver ? moveEvent.clientY : moveEvent.clientX
        line.style[ver ? 'top' : 'left'] = `${origin + current - firstPos}px`
      }

      document.onmouseup = (upEvent: MouseEvent) => {
        if (!active) return
        active = false
        if (onEnd) onEnd()
        const ver = readAxis()
        line.style.display = 'none'
        const landed = Number((line.style[ver ? 'top' : 'left'] as string).split('px')[0]) || origin
        if (landed - origin !== 0) onChangeSize(landed - origin)
        teardown()
      }
    }

    resize.onmousedown = beginDrag
    return teardown
    // 仅在挂载时绑定一次；后续通过 ref 读取最新 axis / 回调
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const vertical = isVer
  return (
    <div
      ref={lineRef}
      className={`sentinel-splitter ${vertical ? 'sentinel-splitter-vertical' : 'sentinel-splitter-horizontal'}`}
      style={
        vertical
          ? { top: `0px`, borderTop: '2px dashed #434344' }
          : { left: `0px`, borderLeft: '2px dashed #434344' }
      }
      draggable
    />
  )
}
