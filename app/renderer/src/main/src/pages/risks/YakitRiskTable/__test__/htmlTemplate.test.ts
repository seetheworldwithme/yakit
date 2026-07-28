import { getHtmlEnTemplate, getHtmlTemplate, getHtmlZhTWTemplate } from '../htmlTemplate'

describe('risk HTML export template', () => {
  it.each([getHtmlTemplate, getHtmlZhTWTemplate, getHtmlEnTemplate])(
    'creates an offline report with the correct title',
    (getTemplate) => {
      const html = getTemplate()

      expect(html).toContain('<title>靖云甲web应用漏洞扫描</title>')
      expect(html).toContain('<script src="./data.js"></script>')
      expect(html).not.toMatch(/https?:\/\//i)

      const inlineScript = html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1]
      expect(inlineScript).toBeTruthy()
      const script = inlineScript || ''
      expect(() => new Function(script)).not.toThrow()

      document.body.innerHTML =
        '<input id="search" /><table><tbody id="risk-list"></tbody></table><div id="empty"></div>'
      new Function('initData', script)([{ Id: 1, Title: 'offline report', Severity: 'high' }])
      expect(document.querySelectorAll('.data-row')).toHaveLength(1)
      expect(document.body.textContent).toContain('offline report')
    },
  )
})
