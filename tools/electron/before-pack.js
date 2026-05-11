const { execSync } = require("child_process");

function resolveGoTarget(platform, archCode) {
  if (platform === "darwin") {
    if (archCode === 3) return { goos: "darwin", goarch: "arm64" };
    return { goos: "darwin", goarch: "amd64" };
  }
  if (platform === "win32") {
    if (archCode === 0) return { goos: "windows", goarch: "386" };
    if (archCode === 3) return { goos: "windows", goarch: "arm64" };
    return { goos: "windows", goarch: "amd64" };
  }
  if (platform === "linux") {
    if (archCode === 0) return { goos: "linux", goarch: "386" };
    if (archCode === 3) return { goos: "linux", goarch: "arm64" };
    return { goos: "linux", goarch: "amd64" };
  }
  throw new Error(`Unsupported platform for backend build: ${platform}`);
}

function run(command, options) {
  execSync(command, {
    stdio: "inherit",
    ...options,
  });
}

module.exports = async function beforePack(context) {
  if (process.env.TOOLS_SKIP_BUILD === "1") return;

  const projectDir = context?.packager?.info?.projectDir || process.cwd();
  const platform = context?.electronPlatformName || process.platform;
  const archCode = context?.arch;
  const { goos, goarch } = resolveGoTarget(platform, archCode);

  run("npm run build:frontend", { cwd: projectDir, env: process.env });

  const baseEnv = {
    ...process.env,
    GOOS: goos,
    GOARCH: goarch,
    CGO_ENABLED: "0",
    GOTOOLCHAIN: process.env.GOTOOLCHAIN || "go1.24.4",
  };

  try {
    run("go build -C backend -o bin/server.exe ./cmd/server", {
      cwd: projectDir,
      env: baseEnv,
    });
  } catch (error) {
    if (goos === "windows" && goarch === "386") {
      const fallbackEnv = { ...baseEnv, GOARCH: "amd64" };
      console.warn(
        "[before-pack] windows/386 backend build failed, fallback to windows/amd64 backend binary.",
      );
      run("go build -C backend -o bin/server.exe ./cmd/server", {
        cwd: projectDir,
        env: fallbackEnv,
      });
      return;
    }
    throw error;
  }
};

module.exports.resolveGoTarget = resolveGoTarget;
