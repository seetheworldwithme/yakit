const test = require("node:test");
const assert = require("node:assert/strict");

const { resolveGoTarget } = require("./before-pack");

test("resolveGoTarget maps mac arm64 correctly", () => {
  assert.deepEqual(resolveGoTarget("darwin", 3), { goos: "darwin", goarch: "arm64" });
});

test("resolveGoTarget maps win ia32 correctly", () => {
  assert.deepEqual(resolveGoTarget("win32", 0), { goos: "windows", goarch: "386" });
});
