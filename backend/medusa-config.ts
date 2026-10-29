import path from "path"
import { loadEnv, defineConfig } from '@medusajs/framework/utils'

// `medusa start` loads the compiled copy from .medusa/server, so resolve paths
// from the backend folder in both cases.
const BACKEND_DIR =
  path.basename(path.dirname(__dirname)) === ".medusa"
    ? path.resolve(__dirname, "../..")
    : __dirname

loadEnv(process.env.NODE_ENV || 'development', BACKEND_DIR)
if (process.cwd() !== BACKEND_DIR) {
  loadEnv(process.env.NODE_ENV || 'development', process.cwd())
}

const CDN_PORT = process.env.CDN_PORT || "9080"
const CDN_URL = process.env.CDN_URL || `http://localhost:${CDN_PORT}`
const CDN_DIR = process.env.CDN_DIR || path.resolve(BACKEND_DIR, "../cdn/files")
const PRIVATE_UPLOAD_DIR =
  process.env.PRIVATE_UPLOAD_DIR || path.resolve(BACKEND_DIR, "uploads")

// kibiimport's image cleanup reads the folder the file provider writes to.
process.env.CDN_DIR = CDN_DIR

// kibijson reads product images uploaded over FTP from this folder.
process.env.KIBIIMPORT_IMAGE_ROOT =
  process.env.KIBIIMPORT_IMAGE_ROOT || path.resolve(BACKEND_DIR, "import-images")

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    },
    cookieOptions: {
      secure: false,
      sameSite: "lax",
    },
  },
  featureFlags: {
    translation: true,
  },
  modules: [
    {
      resolve: "@medusajs/medusa/translation",
    },
    {
      resolve: "@medusajs/medusa/file",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/file-local",
            id: "local",
            options: {
              upload_dir: CDN_DIR,
              private_upload_dir: PRIVATE_UPLOAD_DIR,
              backend_url: CDN_URL,
            },
          },
        ],
      },
    },
    {
      resolve: "./src/kibisis/kibinav",
    },
    {
      resolve: "./src/kibisis/kibipage",
    },
    {
      resolve: "./src/kibisis/kibiimport",
    },
    {
      resolve: "./src/kibisis/kibijson",
    },
    {
      resolve: "./src/kibisis/kibigroup",
    },
    {
      resolve: "./src/kibisis/kibisettings",
    },
    {
      resolve: "./src/kibisis/kibitranslate",
    },
  ],
})
