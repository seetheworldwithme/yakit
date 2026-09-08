// Run with: node scripts/regression-mitm-flow-resize.cjs
// Exercise the actual resize and query callbacks without starting Electron.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('../app/renderer/src/main/node_modules/typescript')

const sourceRoot = path.resolve(__dirname, '../app/renderer/src/main/src')
const parse = (file) =>
  ts.createSourceFile(file, fs.readFileSync(path.join(sourceRoot, file), 'utf8'), ts.ScriptTarget.Latest, true)
const find = (root, predicate) => {
  if (predicate(root)) return root
  return ts.forEachChild(root, (child) => find(child, predicate))
}
const table = parse('components/HTTPFlowTable/HTTPFlowTable.tsx')
const resize = find(table, (node) => ts.isJsxAttribute(node) && node.name.getText(table) === 'onResize')
const hook = parse('hook/useVirtualTableHook/useVirtualTableHook.ts')
const update = find(hook, (node) => ts.isVariableDeclaration(node) && node.name.getText(hook) === 'updateData')
assert.ok(resize && update, 'Expected the production resize and update callbacks')
const callback = (node, source, context) => {
  const js = ts.transpileModule(`(${node.getText(source)})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText
  return vm.runInNewContext(js, context)
}

for (const onlyShowFirstNode of [false, true]) {
  const queries = []
  const boxHeightRef = { current: undefined }
  const noop = () => {}
  const updateData = callback(update.initializer.arguments[0], hook, {
    boxHeightRef,
    onFirst: noop,
    setOffsetData: noop,
    setLoading: noop,
    maxIdRef: { current: 0 },
    minIdRef: { current: 0 },
    params: { Pagination: {}, Filter: { SourceType: 'mitm' } },
    sortRef: { current: { order: 'desc', orderBy: 'Id' } },
    getDataByGrpc: (query) => queries.push(query),
    loopPausedRef: { current: false },
    setIsLoop: noop,
  })
  const onResize = callback(resize.initializer.expression, table, { boxHeightRef, onlyShowFirstNode, updateData })
  onResize(360, 480)
  updateData() // The real-time table's next polling tick.
  assert.ok(queries.length > 0, `No flow query with onlyShowFirstNode=${onlyShowFirstNode}`)
  assert.equal(queries[0].Pagination.Limit, Math.ceil(480 / 28))
  onResize(0, 0) // A hidden tab must not erase the last usable measurement.
  assert.equal(boxHeightRef.current, 480)
  onResize(360, 640)
  updateData()
  assert.equal(queries.at(-1).Pagination.Limit, Math.ceil(640 / 28))
  console.log(`PASS: flow queries start and resize with onlyShowFirstNode=${onlyShowFirstNode}`)
}
