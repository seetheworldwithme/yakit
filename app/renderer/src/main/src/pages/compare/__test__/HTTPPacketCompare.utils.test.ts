import { decodeHTTPPacketBodyForCompare } from '../HTTPPacketCompare.utils'
import { Buffer } from 'buffer'

const pako: { gzip: (data: string) => Uint8Array } = require('pako')

const encodeUTF8 = (value: string) => new Uint8Array(Buffer.from(value, 'utf8'))

const concatBytes = (...parts: Uint8Array[]) => {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0))
  let offset = 0
  parts.forEach((part) => {
    result.set(part, offset)
    offset += part.length
  })
  return result
}

describe('decodeHTTPPacketBodyForCompare', () => {
  it('dechunks and decompresses a gzip response while preserving its headers', () => {
    const body = '<html><body>可读正文</body></html>'
    const compressed = pako.gzip(body)
    const midpoint = Math.floor(compressed.length / 2)
    const first = compressed.slice(0, midpoint)
    const second = compressed.slice(midpoint)
    const packet = concatBytes(
      encodeUTF8(
        'HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Encoding: gzip\r\nTransfer-Encoding: chunked\r\n\r\n',
      ),
      encodeUTF8(`${first.length.toString(16)}\r\n`),
      first,
      encodeUTF8(`\r\n${second.length.toString(16)}\r\n`),
      second,
      encodeUTF8('\r\n0\r\n\r\n'),
    )

    const decoded = decodeHTTPPacketBodyForCompare(packet)

    expect(decoded).toContain('Content-Encoding: gzip')
    expect(decoded).toContain(`\r\n\r\n${body}`)
    expect(decoded).not.toContain('\ufffd')
  })
})
