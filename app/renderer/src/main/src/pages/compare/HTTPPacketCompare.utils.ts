import { Buffer } from 'buffer'

const pako: {
  ungzip: (data: Uint8Array) => Uint8Array
  inflate: (data: Uint8Array) => Uint8Array
} = require('pako')

const decodeUTF8 = (data: Uint8Array) => Buffer.from(data).toString('utf8')

const findBytes = (data: Uint8Array, expected: number[], start = 0) => {
  for (let index = start; index <= data.length - expected.length; index += 1) {
    if (expected.every((byte, offset) => data[index + offset] === byte)) return index
  }
  return -1
}

const concatBytes = (parts: Uint8Array[]) => {
  const result = new Uint8Array(parts.reduce((length, part) => length + part.length, 0))
  let offset = 0
  parts.forEach((part) => {
    result.set(part, offset)
    offset += part.length
  })
  return result
}

const decodeChunkedBody = (body: Uint8Array) => {
  const chunks: Uint8Array[] = []
  let offset = 0

  while (offset < body.length) {
    const lineEnd = findBytes(body, [13, 10], offset)
    if (lineEnd < 0) throw new Error('Invalid chunk size line')
    const sizeText = decodeUTF8(body.slice(offset, lineEnd)).split(';')[0].trim()
    const chunkSize = Number.parseInt(sizeText, 16)
    if (!Number.isFinite(chunkSize)) throw new Error('Invalid chunk size')
    offset = lineEnd + 2
    if (chunkSize === 0) break
    if (offset + chunkSize > body.length) throw new Error('Incomplete chunk body')
    chunks.push(body.slice(offset, offset + chunkSize))
    offset += chunkSize
    if (body[offset] === 13 && body[offset + 1] === 10) offset += 2
  }

  return concatBytes(chunks)
}

export const decodeHTTPPacketBodyForCompare = (packet: Uint8Array) => {
  const headerEnd = findBytes(packet, [13, 10, 13, 10])
  if (headerEnd < 0) return decodeUTF8(packet)

  const separator = '\r\n\r\n'
  const headers = decodeUTF8(packet.slice(0, headerEnd))
  let body = packet.slice(headerEnd + 4)

  try {
    if (/^transfer-encoding\s*:[^\r\n]*\bchunked\b/im.test(headers)) body = decodeChunkedBody(body)

    const contentEncoding = headers.match(/^content-encoding\s*:\s*([^\s,;]+)/im)?.[1]?.toLowerCase()
    if (contentEncoding === 'gzip' || contentEncoding === 'x-gzip') body = pako.ungzip(body)
    else if (contentEncoding === 'deflate') body = pako.inflate(body)

    return `${headers}${separator}${decodeUTF8(body)}`
  } catch {
    return decodeUTF8(packet)
  }
}
