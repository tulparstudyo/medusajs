const fs = require("fs")
const path = require("path")

const root = path.join(__dirname, "..")
const link = path.join(root, "backend", "src", "api")
const target = path.join(root, "routes")

if (!fs.existsSync(target)) {
  console.error("routes is missing")
  process.exit(1)
}

let stat = null
try {
  stat = fs.lstatSync(link)
} catch {
  stat = null
}

if (stat?.isSymbolicLink()) {
  process.exit(0)
}

if (stat?.isDirectory()) {
  const entries = fs.readdirSync(link)
  if (entries.length > 0) {
    console.error(
      "backend/src/api already contains files. Move them to routes, then run this script again."
    )
    process.exit(1)
  }
  fs.rmdirSync(link)
}

fs.symlinkSync(target, link, "junction")
console.log("Linked backend/src/api -> routes")
