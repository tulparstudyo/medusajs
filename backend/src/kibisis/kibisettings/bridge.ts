import type KibisettingsModuleService from "./service"

/**
 * Module providers (e.g. the Payment Module's kibipayment provider) run in
 * their own isolated container and cannot resolve the kibisettings module.
 * The service registers itself here when Medusa instantiates it, so those
 * providers can still read settings in the same process.
 */
const KEY = Symbol.for("kibisis.kibisettings.service")

type Holder = { [KEY]?: KibisettingsModuleService }

export function registerKibisettingsService(service: KibisettingsModuleService): void {
  ;(globalThis as Holder)[KEY] = service
}

export function kibisettingsService(): KibisettingsModuleService | null {
  return (globalThis as Holder)[KEY] ?? null
}

