import { diffChars, diffLines } from 'diff'

export const DIFF_MAX_LINE_LENGTH = 1000

export interface DiffLineRange {
  startLineNumber: number
  endLineNumber: number
}

export interface DiffLineRanges {
  original: DiffLineRange[]
  modified: DiffLineRange[]
}

export interface DiffInlineRange {
  startLineNumber: number
  startColumn: number
  endLineNumber: number
  endColumn: number
}

export interface DiffInlineRanges {
  original: DiffInlineRange[]
  modified: DiffInlineRange[]
}

/**
 * Monaco 会放弃计算包含数十万字符单行内容的 diff。这里只为对比模型插入显示换行，
 * 并统一 CRLF/LF，避免相同 HTTP 头因换行格式不同而被误判为整行变化。
 */
export const prepareDiffText = (content: string, maxLineLength = DIFF_MAX_LINE_LENGTH) => {
  if (!content || maxLineLength <= 0) return content

  return content
    .replace(/\r\n?/g, '\n')
    .split(/(\n)/)
    .map((part) => {
      if (part === '\n' || part.length <= maxLineLength) return part

      const chunks: string[] = []
      for (let start = 0; start < part.length; start += maxLineLength) {
        chunks.push(part.slice(start, start + maxLineLength))
      }
      return chunks.join('\n')
    })
    .join('')
}

/**
 * Monaco 的 Web Worker 冷启动或计算超时时不会返回任何 lineChanges。同步计算一份轻量的
 * 行级差异作为保底，确保超大响应重新启动应用后也能稳定显示高亮。
 */
export const getDiffLineRanges = (original: string, modified: string): DiffLineRanges => {
  const ranges: DiffLineRanges = { original: [], modified: [] }
  let originalLineNumber = 1
  let modifiedLineNumber = 1

  diffLines(original, modified).forEach((change) => {
    const lineCount = change.count || 0
    if (change.removed) {
      if (lineCount > 0) {
        ranges.original.push({
          startLineNumber: originalLineNumber,
          endLineNumber: originalLineNumber + lineCount - 1,
        })
      }
      originalLineNumber += lineCount
      return
    }
    if (change.added) {
      if (lineCount > 0) {
        ranges.modified.push({
          startLineNumber: modifiedLineNumber,
          endLineNumber: modifiedLineNumber + lineCount - 1,
        })
      }
      modifiedLineNumber += lineCount
      return
    }

    originalLineNumber += lineCount
    modifiedLineNumber += lineCount
  })

  return ranges
}

const splitChangedLines = (value: string) => {
  const lines = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  if (lines.at(-1) === '') lines.pop()
  return lines
}

export const getDiffInlineRanges = (original: string, modified: string): DiffInlineRanges => {
  const ranges: DiffInlineRanges = { original: [], modified: [] }
  const lineChanges = diffLines(original, modified)
  let originalLineNumber = 1
  let modifiedLineNumber = 1

  lineChanges.forEach((change, index) => {
    const lineCount = change.count || 0
    const nextChange = lineChanges[index + 1]
    if (change.removed && nextChange?.added) {
      const originalLines = splitChangedLines(change.value)
      const modifiedLines = splitChangedLines(nextChange.value)
      const pairedLineCount = Math.min(originalLines.length, modifiedLines.length)

      for (let lineIndex = 0; lineIndex < pairedLineCount; lineIndex += 1) {
        if (originalLines[lineIndex].length > 500 || modifiedLines[lineIndex].length > 500) continue
        const inlineChanges = diffChars(originalLines[lineIndex], modifiedLines[lineIndex])
        const commonCharacterCount = inlineChanges.reduce(
          (count, inlineChange) =>
            count + (!inlineChange.added && !inlineChange.removed ? inlineChange.value.length : 0),
          0,
        )
        const longestLineLength = Math.max(originalLines[lineIndex].length, modifiedLines[lineIndex].length)
        if (longestLineLength > 0 && commonCharacterCount / longestLineLength < 0.5) continue

        let originalColumn = 1
        let modifiedColumn = 1
        inlineChanges.forEach((inlineChange) => {
          const characterCount = inlineChange.value.length
          if (inlineChange.removed && characterCount > 0) {
            ranges.original.push({
              startLineNumber: originalLineNumber + lineIndex,
              startColumn: originalColumn,
              endLineNumber: originalLineNumber + lineIndex,
              endColumn: originalColumn + characterCount,
            })
            originalColumn += characterCount
            return
          }
          if (inlineChange.added && characterCount > 0) {
            ranges.modified.push({
              startLineNumber: modifiedLineNumber + lineIndex,
              startColumn: modifiedColumn,
              endLineNumber: modifiedLineNumber + lineIndex,
              endColumn: modifiedColumn + characterCount,
            })
            modifiedColumn += characterCount
            return
          }
          originalColumn += characterCount
          modifiedColumn += characterCount
        })
      }
    }

    if (change.removed) originalLineNumber += lineCount
    else if (change.added) modifiedLineNumber += lineCount
    else {
      originalLineNumber += lineCount
      modifiedLineNumber += lineCount
    }
  })

  return ranges
}
