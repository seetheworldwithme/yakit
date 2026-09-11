import { getDiffInlineRanges, getDiffLineRanges, prepareDiffText } from '../DataCompare.utils'

describe('prepareDiffText', () => {
  it('normalizes line endings so equal HTTP headers stay aligned', () => {
    const packet = 'HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\nhello'

    expect(prepareDiffText(packet)).toBe('HTTP/1.1 200 OK\nContent-Type: text/plain\n\nhello')
  })

  it('splits only oversized single lines so Monaco can calculate the diff', () => {
    const packet = `Header: value\r\n\r\n${'a'.repeat(2501)}`
    const prepared = prepareDiffText(packet, 1000)
    const [headers, body] = prepared.split('\n\n')

    expect(headers).toBe('Header: value')
    expect(body.split('\n').map((line) => line.length)).toEqual([1000, 1000, 501])
    expect(body.replaceAll('\n', '')).toBe('a'.repeat(2501))
  })

  it('finds changed lines without relying on the Monaco worker', () => {
    const original = 'HTTP/1.1 200 OK111111\r\nConnection: keep-alive\r\nServer: BWS/1.1'
    const modified = 'HTTP/1.1 200 OK\r\nConnection: keep-alive\r\nContent-Encoding: gzip\r\nServer: BWS/1.1'

    expect(getDiffLineRanges(original, modified)).toEqual({
      original: [{ startLineNumber: 1, endLineNumber: 1 }],
      modified: [
        { startLineNumber: 1, endLineNumber: 1 },
        { startLineNumber: 3, endLineNumber: 3 },
      ],
    })
  })

  it('finds the exact changed characters in paired lines', () => {
    expect(getDiffInlineRanges('HTTP/1.1 200 OK111111', 'HTTP/1.1 200 OK')).toEqual({
      original: [
        {
          startLineNumber: 1,
          startColumn: 16,
          endLineNumber: 1,
          endColumn: 22,
        },
      ],
      modified: [],
    })
  })

  it('does not create noisy character marks for unrelated replacement lines', () => {
    expect(getDiffInlineRanges('Content-Length: 562830', 'Transfer-Encoding: chunked')).toEqual({
      original: [],
      modified: [],
    })
  })
})
