import type { ExecArgs, RuleOperatorType } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createRegionsWorkflow,
  createServiceZonesWorkflow,
  createShippingOptionsWorkflow,
  createTaxRegionsWorkflow,
  updateProductVariantsWorkflow,
  updateRegionsWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows"

type RegionSpec = {
  name: string
  currency: string
  countries: string[]
  shipping?: { standard: number; express: number }
}

const DEFAULT_CURRENCY = "try"

const TURKEY: RegionSpec = {
  name: "Türkiye",
  currency: "try",
  countries: ["tr"],
  shipping: { standard: 100, express: 200 },
}
const EUROPE: RegionSpec = {
  name: "Avrupa",
  currency: "eur",
  countries: ["dk", "fr", "de", "it", "es", "se", "gb"],
}
const RUSSIA: RegionSpec = {
  name: "Rusya",
  currency: "rub",
  countries: ["ru"],
  shipping: { standard: 500, express: 1000 },
}

const REGIONS = [TURKEY, EUROPE, RUSSIA]

type VariantWithPrices = {
  id: string
  prices?: {
    id: string
    amount: number | string
    currency_code: string
    min_quantity?: number | string | null
    max_quantity?: number | string | null
    price_list_id?: string | null
    price_rules?: { attribute: string; value: string }[]
  }[]
}

/**
 * Sets up one region per storefront currency: Türkiye (TRY), Avrupa (EUR), Rusya (RUB).
 * Safe to run more than once.
 */
export default async function setupCurrencyRegions({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const {
    data: [store],
  } = await query.graph({
    entity: "store",
    fields: ["id", "default_region_id", "supported_currencies.currency_code"],
    pagination: { take: 1 },
  })
  if (!store) {
    logger.warn("setup-currency-regions: mağaza bulunamadı.")
    return
  }

  const currencies = new Set(
    (store.supported_currencies ?? [])
      .map((currency) => currency?.currency_code)
      .filter((code): code is string => !!code)
  )
  REGIONS.forEach((region) => currencies.add(region.currency))
  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        supported_currencies: [...currencies].map((currency_code) => ({
          currency_code,
          is_default: currency_code === DEFAULT_CURRENCY,
        })),
      },
    },
  })
  logger.info(`setup-currency-regions: mağaza para birimleri: ${[...currencies].join(", ")}`)

  const loadRegions = async () => {
    const { data } = await query.graph({
      entity: "region",
      fields: ["id", "name", "currency_code", "countries.iso_2"],
    })
    return data
  }

  const regionIds: Record<string, string> = {}
  let regions = await loadRegions()
  const toCreate: RegionSpec[] = []

  for (const spec of REGIONS) {
    const existing = regions.find((region) =>
      (region.countries ?? []).some((country) => spec.countries.includes(country?.iso_2 ?? ""))
    )
    if (!existing) {
      toCreate.push(spec)
      continue
    }
    regionIds[spec.currency] = existing.id
    if (existing.name !== spec.name || existing.currency_code !== spec.currency) {
      await updateRegionsWorkflow(container).run({
        input: {
          selector: { id: existing.id },
          update: { name: spec.name, currency_code: spec.currency },
        },
      })
      logger.info(`setup-currency-regions: ${existing.name} -> ${spec.name} (${spec.currency})`)
    }
  }

  if (toCreate.length) {
    const { result } = await createRegionsWorkflow(container).run({
      input: {
        regions: toCreate.map((spec) => ({
          name: spec.name,
          currency_code: spec.currency,
          countries: spec.countries,
          payment_providers: ["pp_system_default"],
        })),
      },
    })
    result.forEach((region) => {
      regionIds[region.currency_code] = region.id
      logger.info(`setup-currency-regions: bölge oluşturuldu: ${region.name} (${region.currency_code})`)
    })
  }

  if (store.default_region_id !== regionIds[DEFAULT_CURRENCY]) {
    await updateStoresWorkflow(container).run({
      input: {
        selector: { id: store.id },
        update: { default_region_id: regionIds[DEFAULT_CURRENCY] },
      },
    })
  }

  const allCountries = REGIONS.flatMap((spec) => spec.countries)

  const { data: taxRegions } = await query.graph({
    entity: "tax_region",
    fields: ["country_code", "province_code"],
  })
  const taxCountries = new Set(
    taxRegions.filter((tax) => !tax.province_code).map((tax) => tax.country_code)
  )
  const missingTax = allCountries.filter((country) => !taxCountries.has(country))
  if (missingTax.length) {
    await createTaxRegionsWorkflow(container).run({
      input: missingTax.map((country_code) => ({ country_code, provider_id: "tp_system" })),
    })
    logger.info(`setup-currency-regions: vergi bölgeleri eklendi: ${missingTax.join(", ")}`)
  }

  const { data: fulfillmentSets } = await query.graph({
    entity: "fulfillment_set",
    fields: ["id", "type", "service_zones.geo_zones.country_code"],
  })
  const shippingSet = fulfillmentSets.find((set) => set.type === "shipping")
  if (shippingSet) {
    const covered = new Set(
      (shippingSet.service_zones ?? []).flatMap((zone) =>
        (zone?.geo_zones ?? []).map((geo) => geo?.country_code)
      )
    )
    const zones = [TURKEY, RUSSIA]
      .filter((spec) => spec.countries.some((country) => !covered.has(country)))
      .map((spec) => ({
        name: spec.name,
        fulfillment_set_id: shippingSet.id,
        geo_zones: spec.countries.map((country_code) => ({
          type: "country" as const,
          country_code,
        })),
      }))
    if (zones.length) {
      await createServiceZonesWorkflow(container).run({ input: { data: zones } })
      logger.info(
        `setup-currency-regions: kargo bölgeleri eklendi: ${zones.map((zone) => zone.name).join(", ")}`
      )
    }
  } else {
    logger.warn("setup-currency-regions: kargo fulfillment set'i bulunamadı, kargo bölgesi eklenmedi.")
  }

  await createZoneShippingOptions(container)
  await detachRegionBoundPrices(container)

  regions = await loadRegions()
  regions.forEach((region) =>
    logger.info(
      `setup-currency-regions: ${region.name} | ${region.currency_code} | ${(region.countries ?? [])
        .map((country) => country?.iso_2)
        .join(",")}`
    )
  )
}

/**
 * Gives each region's service zone a Standard and an Express option, copying type,
 * provider, profile and rules from the existing options of the same type code.
 */
async function createZoneShippingOptions(container: ExecArgs["container"]) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: zones } = await query.graph({
    entity: "service_zone",
    fields: ["id", "name", "geo_zones.country_code"],
  })
  const { data: options } = await query.graph({
    entity: "shipping_option",
    fields: [
      "id",
      "service_zone_id",
      "provider_id",
      "shipping_profile_id",
      "type.id",
      "type.code",
      "rules.attribute",
      "rules.operator",
      "rules.value",
    ],
  })

  const templates = {
    standard: options.find((option) => option.type?.code === "standard"),
    express: options.find((option) => option.type?.code === "express"),
  }
  if (!templates.standard || !templates.express) {
    logger.warn("setup-currency-regions: örnek Standart/Ekspres kargo seçeneği yok, kargo eklenmedi.")
    return
  }

  const input = REGIONS.flatMap((spec) => {
    const shipping = spec.shipping
    const zone = zones.find((candidate) =>
      (candidate.geo_zones ?? []).some((geo) => spec.countries.includes(geo?.country_code ?? ""))
    )
    if (!shipping || !zone || options.some((option) => option.service_zone_id === zone.id)) {
      return []
    }

    return (["standard", "express"] as const).map((code) => {
      const template = templates[code]!
      return {
        name: `${code === "standard" ? "Standard" : "Express"} Shipping`,
        price_type: "flat" as const,
        provider_id: template.provider_id!,
        service_zone_id: zone.id,
        shipping_profile_id: template.shipping_profile_id!,
        type_id: template.type!.id,
        prices: [{ currency_code: spec.currency, amount: shipping[code] }],
        rules: (template.rules ?? []).map((rule) => ({
          attribute: rule!.attribute,
          operator: rule!.operator as RuleOperatorType,
          value: rule!.value as unknown as string | string[],
        })),
      }
    })
  })

  if (!input.length) {
    return
  }

  await createShippingOptionsWorkflow(container).run({ input })
  logger.info(`setup-currency-regions: ${input.length} kargo seçeneği eklendi.`)
}

/**
 * A variant price bound to a region whose currency no longer matches would never apply,
 * so it becomes a plain currency price that every region in that currency picks up.
 */
async function detachRegionBoundPrices(container: ExecArgs["container"]) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "currency_code"],
  })
  const regionCurrency = new Map(regions.map((region) => [region.id, region.currency_code]))

  const { data: variants } = await query.graph({
    entity: "product_variant",
    fields: [
      "id",
      "prices.id",
      "prices.amount",
      "prices.currency_code",
      "prices.min_quantity",
      "prices.max_quantity",
      "prices.price_list_id",
      "prices.price_rules.attribute",
      "prices.price_rules.value",
    ],
  })

  const updates = (variants as unknown as VariantWithPrices[]).flatMap((variant) => {
    const prices = (variant.prices ?? []).filter((price) => !price.price_list_id)
    const stale = prices.filter((price) => {
      const regionId = price.price_rules?.find((rule) => rule.attribute === "region_id")?.value
      return (
        !!regionId &&
        regionCurrency.has(regionId) &&
        regionCurrency.get(regionId) !== price.currency_code
      )
    })
    if (!stale.length) {
      return []
    }

    const kept = prices
      .filter((price) => !stale.includes(price))
      .map((price) => ({
        id: price.id,
        amount: Number(price.amount),
        currency_code: price.currency_code,
        min_quantity: price.min_quantity == null ? undefined : Number(price.min_quantity),
        max_quantity: price.max_quantity == null ? undefined : Number(price.max_quantity),
        rules: Object.fromEntries(
          (price.price_rules ?? []).map((rule) => [rule.attribute, rule.value])
        ),
      }))
    const plainCurrencies = new Set(
      kept.filter((price) => !Object.keys(price.rules).length).map((price) => price.currency_code)
    )
    const promoted = stale
      .filter((price) => !plainCurrencies.has(price.currency_code))
      .map((price) => ({ amount: Number(price.amount), currency_code: price.currency_code }))

    return [{ id: variant.id, prices: [...kept, ...promoted] }]
  })

  if (!updates.length) {
    return
  }

  await updateProductVariantsWorkflow(container).run({
    input: { product_variants: updates },
  })
  logger.info(
    `setup-currency-regions: bölgeye bağlı ${updates.length} varyant fiyatı genel fiyata çevrildi.`
  )
}
