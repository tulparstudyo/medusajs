import { ImportException } from "./errors"
import { hostMatches, productHost } from "./lib/urls"
import { ProductAdapter, ProductClient } from "./types"
import { KozmoyaAdapter } from "./sources/kozmoya/adapter"
import { KozmoyaClient } from "./sources/kozmoya/client"
import { TrendyolAdapter } from "./sources/trendyol/adapter"
import { TrendyolClient } from "./sources/trendyol/client"

export type Source = {
  client: ProductClient
  adapter: ProductAdapter
}

type SourceDefinition = {
  hosts: string[]
  client: new () => ProductClient
  adapter: new () => ProductAdapter
}

/**
 * SourceRegistry picks the client and adapter from the product link's domain.
 * A new shop is one row: the hosts it answers, and the pair that reads it.
 */
export class SourceRegistry {
  private readonly sources: SourceDefinition[] = [
    {
      hosts: ["trendyol.com"],
      client: TrendyolClient,
      adapter: TrendyolAdapter,
    },
    {
      hosts: ["kozmoya.com"],
      client: KozmoyaClient,
      adapter: KozmoyaAdapter,
    },
  ]

  match(url: string): Source {
    const host = productHost(url)

    for (const source of this.sources) {
      if (source.hosts.some((candidate) => hostMatches(host, candidate))) {
        return {
          client: new source.client(),
          adapter: new source.adapter(),
        }
      }
    }

    throw new ImportException(`${host} için ürün içe aktarıcı kayıtlı değil.`)
  }

  key(url: string): string {
    try {
      return this.match(url).adapter.productKey(url)
    } catch {
      return url.trim()
    }
  }
}
