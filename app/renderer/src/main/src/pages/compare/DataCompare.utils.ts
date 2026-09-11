export const DIFF_MAX_LINE_LENGTH = 1000

/**
 * Monaco 会放弃计算包含数十万字符单行内容的 diff。这里只为对比模型插入显示换行，
 * 原始响应包以及已有的 CRLF/LF 均保持不变。
 */
export const prepareDiffText = (content: string, maxLineLength = DIFF_MAX_LINE_LENGTH) => {
  if (!content || maxLineLength <= 0) return content

  return content
    .split(/(\r\n|\n|\r)/)
    .map((part) => {
      if (part === '\r\n' || part === '\n' || part === '\r' || part.length <= maxLineLength) return part

      const chunks: string[] = []
      for (let start = 0; start < part.length; start += maxLineLength) {
        chunks.push(part.slice(start, start + maxLineLength))
      }
      return chunks.join('\n')
    })
    .join('')
}
