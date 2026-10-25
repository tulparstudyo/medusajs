import path from "path"

const MODULE_PATH = path.join("src", "kibisis", "kibicarrier")

export function backendRoot(): string {
  const index = __dirname.lastIndexOf(MODULE_PATH)
  let root = index === -1 ? process.cwd() : __dirname.slice(0, index - 1)

  if (path.basename(root) === "server" && path.basename(path.dirname(root)) === ".medusa") {
    root = path.dirname(path.dirname(root))
  }

  return root
}

export function workDir(): string {
  return path.join(backendRoot(), ".kibisis")
}

/**
 * Compiled carriers live outside src/ and .medusa/, so installing one needs
 * no build, does not restart a dev server and survives `medusa build`.
 */
export function carriersDir(): string {
  return path.join(workDir(), "carriers")
}

/** Touched after every install; running processes reload carriers when it changes. */
export function stampFile(): string {
  return path.join(carriersDir(), "stamp")
}
