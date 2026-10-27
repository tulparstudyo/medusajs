import {
  configureStoreSearch,
  defineMiddlewares,
  validateAndTransformBody,
} from "@medusajs/framework/http"

import {
  CreateNavItemSchema,
  ReorderNavSchema,
  UpdateNavItemSchema,
} from "../kibisis/kibinav/validators"
import {
  CreateSectionSchema,
  ReorderSectionsSchema,
  UpdateSectionSchema,
} from "../kibisis/kibipage/validators"
import { ImportProductsSchema } from "../kibisis/kibiimport/validators"
import { AssignGroupSchema } from "../kibisis/kibigroup/validators"
import { CreateShipmentSchema, InstallCarrierSchema } from "../kibisis/kibicarrier/validators"
import { SETTINGS_KEYS } from "../kibisis/kibisettings/types"
import { SETTINGS_SCHEMAS } from "../kibisis/kibisettings/validators"
import {
  DeleteMemorySchema,
  EditMemorySchema,
  TranslateTextsSchema,
} from "../kibisis/kibitranslate/validators"

// The product index declares filterable `status` and `sales_channel_ids`, so
// the route narrows it to published products in the key's sales channels.
export default defineMiddlewares({
  routes: [
    {
      method: ['POST'],
      matcher: '/store/search',
      middlewares: [
        configureStoreSearch({
          allowed_indexes: {
            product: true,
          },
        }),
      ],
    },
    {
      method: ["POST"],
      matcher: "/admin/kibinav/items",
      middlewares: [validateAndTransformBody(CreateNavItemSchema)],
    },
    {
      method: ["POST"],
      matcher: "/admin/kibinav/items/:id",
      middlewares: [validateAndTransformBody(UpdateNavItemSchema)],
    },
    {
      method: ["POST"],
      matcher: "/admin/kibinav/reorder",
      middlewares: [validateAndTransformBody(ReorderNavSchema)],
    },
    {
      method: ["POST"],
      matcher: "/admin/kibipage/pages/:key/sections",
      middlewares: [validateAndTransformBody(CreateSectionSchema)],
    },
    {
      method: ["POST"],
      matcher: "/admin/kibipage/sections/:id",
      middlewares: [validateAndTransformBody(UpdateSectionSchema)],
    },
    {
      method: ["POST"],
      matcher: "/admin/kibipage/reorder",
      middlewares: [validateAndTransformBody(ReorderSectionsSchema)],
    },
    {
      method: ["POST"],
      matcher: "/admin/kibiimport",
      middlewares: [validateAndTransformBody(ImportProductsSchema)],
    },
    {
      method: ["POST"],
      matcher: "/admin/kibigroup/products/:id",
      middlewares: [validateAndTransformBody(AssignGroupSchema)],
    },
    {
      method: ["POST"],
      matcher: "/admin/kibicarrier/install",
      middlewares: [validateAndTransformBody(InstallCarrierSchema)],
    },
    {
      method: ["POST"],
      matcher: "/admin/kibicarrier/carriers/:id/shipments",
      middlewares: [validateAndTransformBody(CreateShipmentSchema)],
    },
    {
      method: ["POST"],
      matcher: "/admin/kibitranslate",
      middlewares: [validateAndTransformBody(TranslateTextsSchema)],
    },
    {
      method: ["POST"],
      matcher: "/admin/kibitranslate/memory/batch/delete",
      middlewares: [validateAndTransformBody(DeleteMemorySchema)],
    },
    {
      method: ["POST"],
      matcher: "/admin/kibitranslate/memory/:id",
      middlewares: [validateAndTransformBody(EditMemorySchema)],
    },
    ...SETTINGS_KEYS.map((key) => ({
      method: ["POST" as const],
      matcher: `/admin/kibisettings/${key}`,
      middlewares: [validateAndTransformBody(SETTINGS_SCHEMAS[key])],
    })),
  ],
})
