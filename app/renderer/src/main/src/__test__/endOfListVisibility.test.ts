import fs from 'fs'
import path from 'path'

const sourceRoot = path.resolve(__dirname, '..')

const hardcodedEndOfListFiles = [
  'pages/aiForge/forgeEditor/ForgeEditor.tsx',
  'pages/misstatement/Misstatement.tsx',
  'pages/payloadManager/onlinePayload/NewPayloadOnlineList.tsx',
  'pages/pluginEditor/editorCode/EditorCode.tsx',
  'pages/pluginHub/group/PluginGroupList.tsx',
  'pages/pluginHub/pluginLog/PluginLogList.tsx',
  'pages/plugins/operator/localPluginExecuteDetailHeard/PluginExecuteExtraParams.tsx',
  'pages/plugins/pluginBatchExecutor/PluginBatchExecuteExtraParams.tsx',
  'pages/simpleDetect/SimpleDetectExtraParamsDrawer.tsx',
  'pages/yakJavaDecompiler/RunnerFileTree/RunnerFileTree.tsx',
  'pages/yakRunnerAuditCode/GlobalFilterFunction/GlobalFilterFunction.tsx',
  'pages/yakRunnerCodeScan/CodeScanExtraParamsDrawer/CodeScanExtraParamsDrawer.tsx',
]

describe('end-of-list visibility', () => {
  it('hides the shared end-of-list text in every built-in locale', () => {
    for (const locale of ['zh', 'zh-TW', 'en']) {
      const localePath = path.resolve(sourceRoot, `../public/locales/${locale}/yakitUi.json`)
      const translation = JSON.parse(fs.readFileSync(localePath, 'utf8'))

      expect(translation.YakitEmpty.end_of_list).toBe('')
    }
  })

  it('keeps hardcoded end-of-list UI paths hidden reversibly', () => {
    for (const filePath of hardcodedEndOfListFiles) {
      const source = fs.readFileSync(path.resolve(sourceRoot, filePath), 'utf8')

      expect(source).toContain('已经到底啦提示按产品要求隐藏')
    }
  })
})
