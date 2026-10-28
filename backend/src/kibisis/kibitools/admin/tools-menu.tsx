import { ArrowDownTray, ChevronRight, DocumentText, SquaresPlus } from "@medusajs/icons"
import { Container, Heading, Text } from "@medusajs/ui"
import { Link } from "react-router-dom"

const TOOLS = [
  {
    path: "/kibitools/kibiimport",
    label: "Ürün Aktar",
    description: "Trendyol ve Kozmoya linklerinden ürünleri içe aktarın.",
    icon: ArrowDownTray,
  },
  {
    path: "/kibitools/kibijson",
    label: "JSON Ürün Aktar",
    description: "kibiimport.product/v1 JSON dosyalarını ve FTP'deki görselleri kuyrukla içe aktarın.",
    icon: DocumentText,
  },
  {
    path: "/kibitools/kibicategory",
    label: "JSON Kategori Aktar",
    description: "Bir JSON kategori listesini seçilen üst kategorinin altına ağaç olarak aktarın.",
    icon: SquaresPlus,
  },
]

export function ToolsMenuList() {
  return (
    <Container className="divide-y p-0">
      <div className="px-6 py-4">
        <Heading level="h1">Kibitools</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Kullanmak istediğiniz aracı seçin.
        </Text>
      </div>
      <div className="flex flex-col gap-y-2 px-6 py-4">
        {TOOLS.map((tool) => (
          <Link
            key={tool.path}
            to={tool.path}
            className="flex items-center gap-x-4 rounded-lg border border-ui-border-base px-4 py-3 transition-colors hover:bg-ui-bg-base-hover"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-ui-border-base bg-ui-bg-subtle text-ui-fg-subtle">
              <tool.icon aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <Text weight="plus">{tool.label}</Text>
              <Text size="small" className="text-ui-fg-subtle">
                {tool.description}
              </Text>
            </span>
            <ChevronRight className="shrink-0 text-ui-fg-muted" aria-hidden="true" />
          </Link>
        ))}
      </div>
    </Container>
  )
}
