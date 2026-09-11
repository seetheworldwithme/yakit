import { prepareDiffText } from '../DataCompare.utils'

describe('prepareDiffText', () => {
  it('keeps ordinary HTTP packets and their line endings unchanged', () => {
    const packet = 'HTTP/1.1 200 OK\r\nContent-Type: text/plain\r\n\r\nhello'

    expect(prepareDiffText(packet)).toBe(packet)
  })

  it('splits only oversized single lines so Monaco can calculate the diff', () => {
    const packet = `Header: value\r\n\r\n${'a'.repeat(2501)}`
    const prepared = prepareDiffText(packet, 1000)
    const [headers, body] = prepared.split('\r\n\r\n')

    expect(headers).toBe('Header: value')
    expect(body.split('\n').map((line) => line.length)).toEqual([1000, 1000, 501])
    expect(body.replaceAll('\n', '')).toBe('a'.repeat(2501))
  })
})
