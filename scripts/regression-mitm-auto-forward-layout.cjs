// Run with: node scripts/regression-mitm-auto-forward-layout.cjs
// Guard the MITM auto-forward layout contract without starting Electron.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')

const sourceRoot = path.resolve(__dirname, '../app/renderer/src/main/src')
const read = (file) => fs.readFileSync(path.join(sourceRoot, file), 'utf8')

const history = read('components/HTTPHistory.tsx')
const resizeBox = read('components/yakitUI/YakitResizeBox/YakitResizeBox.tsx')

assert.match(
  history,
  /defaultValue:\s*true/,
  'MITM auto-forward must start with only the flow table visible',
)
assert.match(
  history,
  /showFlod=\{isMITMFlowWorkbench\s*\?\s*false\s*:\s*showFlod\}/,
  'MITM detail must hide the internal codec expand rail',
)
assert.match(
  history,
  /showHorizontalCollapseHandle=\{isMITMFlowWorkbench\}/,
  'MITM split view must opt in to the horizontal collapse control',
)
assert.match(
  resizeBox,
  /showHorizontalCollapseHandle\?:\s*boolean/,
  'YakitResizeBox must expose an opt-in horizontal collapse control',
)
assert.match(
  resizeBox,
  /!isVer\s*&&\s*showHorizontalCollapseHandle\s*&&\s*!!onClickHiddenBox/,
  'The horizontal collapse control must invoke the existing hide callback',
)

console.log('PASS: MITM auto-forward starts full width and can collapse request/response details')
