import { KozmoyaAdapter, withoutSize } from "../sources/kozmoya/adapter"
import {
  galleryImages,
  mainSection,
  oldPrice,
  optionGroups,
  parsePrice,
  productId,
  productLd,
  productLink,
  repairJson,
  siblings,
  stockText,
} from "../sources/kozmoya/parse"

const PAGE = "https://www.kozmoya.com/American-Crew-Precision-Shave-Gel-50ml"

const simplePage = `
<div id="leftSide">
  <a id="ekthumb" class="thumbnail" href="https://www.kozmoya.com/image/cache/catalog/ekfoto/669-800x800.webp"><img></a>
  <a class="thumbnail" href="https://www.kozmoya.com/image/cache/catalog/ekfoto/669-1-800x800.webp"><img></a>
</div>
<h1>American Crew Precision Shave Gel 50ml</h1>
<li><b>Stok Durumu: </b><sapn id="stock-status"><font color="green">Stokta Var</font></span></li>
<h2><span style="text-decoration: line-through; color:#ff005a"><b>1.240,00TL</b></span> <b id="fiyat">180,00TL</b></h2>
<div id="digerBoyut">
  <label class="control-label" for="input-option468">Ürün Boyutu</label>
  <select aria-label="Ambalaj Boyutu" onChange="location = this.value" class="form-control">
    <option value="https://www.kozmoya.com/American-Crew-Precision-Shave-Gel-50ml" selected>50ml</option>
    <option value="https://www.kozmoya.com/American-Crew-Precision-Shave-Gel-150ml">150ml</option>
    <option value="https://www.kozmoya.com/American-Crew-Precision-Shave-Gel-450ml">450ml</option>
  </select>
</div>
<input type="hidden" name="product_id" value="5027"/>
<a class="thumbnail" href="https://www.kozmoya.com/image/related-800x800.webp"></a>
<script type="application/ld+json">{"@type":"Organization"}</script>
<script type="application/ld+json">
{
  "@type": "Product",
  "name": "American Crew Precision Shave Gel 50ml",
  "description": "Şeffaf jel.
	Cildi rahatlatır.",
  "additionalProperty": [
    {"@type": "PropertyValue", "name": "Özellikler", "value": "Şeffaf jel.
	Cildi rahatlatır."},
    {"@type": "PropertyValue", "name": "İçerik", "value": "Aloe Vera"},
  ],
  "gtin": "669316406171",
  "mpn": "AC/SHAVE/GEL50",
  "brand": {"@type": "Brand", "name": "American Crew"},
  "offers": {"@type": "Offer", "priceCurrency": "TRY", "price": 180.00, "availability": "https://schema.org/InStock"}
}
</script>`

const optionPage = `
<h1>LOREAL Majirel Saç Boyası 60ml</h1>
<h2><span style="text-decoration: line-through"><b>850,00TL</b></span> 555,00TL</h2>
<div class="form-group required">
  <label class="control-label" for="input-option704">Majirel Ton</label>
  <select name="option[704]" id="input-option704" class="form-control selectpicker">
    <option value=""> --- Seçiniz --- </option>
    <option data-content="<img src='https://x/1.webp' alt='Renk kodu'> 1 - Siyah" value="9047" data-barkod="3474637283261" data-sku="LR_MJRL_1" data-stok="var">1 - Siyah</option>
     (Stokta yok)  <option data-content="<img src='https://x/4.8.webp'> 4.8 - Kahve Moka <span class=outofstock>(Stokta yok)</span>" disabledx="disabledx" value="9069" data-barkod="3474637280642" data-sku="LR_MJRL_4_8" data-stok="yokx" data-tup="https://x/box-4.8.webp" data-ciopimagepopup="https://x/4.8-800.webp" data-ciopekfoto="https://x/doku.webp,https://x/sonuc.webp">4.8 - Kahve Moka</option>
    <option value="9070" data-barkod="" data-sku="" data-stok="">5.1 - Açık Kahve Küllü</option>
  </select>
</div>
<input type="hidden" name="product_id" value="5358"/>`

const optionLd = {
  "@type": "ProductGroup",
  name: "LOREAL Majirel Saç Boyası 60ml",
  brand: { name: "L&#39;Oréal Professionnel" },
  offers: { priceCurrency: "TRY", price: 555, availability: "https://schema.org/InStock" },
  hasVariant: [
    { gtin: "3474637283261", offers: { price: 600, availability: "https://schema.org/InStock" } },
    { gtin: "3474637280642", offers: { price: 555, availability: "https://schema.org/OutOfStock" } },
  ],
}

describe("kozmoya", () => {
  it("reads the product block although its strings hold raw line breaks", () => {
    const ld = productLd(simplePage)

    expect(ld?.["@type"]).toBe("Product")
    expect(ld?.description).toBe("Şeffaf jel.\n\tCildi rahatlatır.")
  })

  it("keeps the offer that the product group template prints after an extra brace", () => {
    const broken = '{"@type": "ProductGroup", "hasVariant": [{"gtin": "1"},]\n\t\t},\n\n\t"offers": {"price": 555.00}\n}\n'

    expect(JSON.parse(repairJson(broken))).toEqual({
      "@type": "ProductGroup",
      hasVariant: [{ gtin: "1" }],
      offers: { price: 555 },
    })
  })

  it("opens the product page of a variant link", () => {
    expect(productLink("https://www.kozmoya.com/Loreal-Majirel-Sac-Boyasi-60ml-v-LR_MJRL_1")).toBe(
      "https://www.kozmoya.com/Loreal-Majirel-Sac-Boyasi-60ml"
    )
    expect(productLink(PAGE)).toBe(PAGE)
  })

  it("reads the product form", () => {
    const section = mainSection(simplePage)

    expect(productId(simplePage)).toBe("5027")
    expect(galleryImages(simplePage, PAGE)).toEqual([
      "https://www.kozmoya.com/image/cache/catalog/ekfoto/669-800x800.webp",
      "https://www.kozmoya.com/image/cache/catalog/ekfoto/669-1-800x800.webp",
    ])
    expect(oldPrice(section)).toBe("1240.00")
    expect(stockText(section)).toBe("Stokta Var")
    expect(optionGroups(section)).toEqual([])
    expect(siblings(section, PAGE)).toEqual({
      name: "Ürün Boyutu",
      links: [
        { url: "https://www.kozmoya.com/American-Crew-Precision-Shave-Gel-50ml", label: "50ml", selected: true },
        { url: "https://www.kozmoya.com/American-Crew-Precision-Shave-Gel-150ml", label: "150ml", selected: false },
        { url: "https://www.kozmoya.com/American-Crew-Precision-Shave-Gel-450ml", label: "450ml", selected: false },
      ],
    })
  })

  it("parses shop prices", () => {
    expect(parsePrice("1.341,00TL")).toBe("1341.00")
    expect(parsePrice("1,341.00 TL")).toBe("1341.00")
    expect(parsePrice("180")).toBe("180")
    expect(parsePrice("TL")).toBe("")
  })

  it("merges the size pages into one product with a size axis", () => {
    const section = mainSection(simplePage)
    const page50 = {
      productId: productId(simplePage),
      ld: productLd(simplePage),
      oldPrice: oldPrice(section),
      stock: stockText(section),
      images: galleryImages(simplePage, PAGE),
      options: optionGroups(section),
      size: "50ml",
    }
    const page150 = {
      productId: "2805",
      ld: {
        "@type": "Product",
        name: "American Crew Precision Shave Gel Tıraş Jeli 150 ml",
        gtin: "0669316406168",
        mpn: "AC/SHAVE/GEL150",
        brand: { name: "American Crew" },
        description: "150 ml açıklaması",
        offers: { priceCurrency: "TRY", price: 1341, availability: "https://schema.org/OutOfStock" },
      },
      images: ["https://www.kozmoya.com/image/cache/catalog/ekfoto/669-800x800.webp", "https://www.kozmoya.com/150.webp"],
      size: "150ml",
    }
    const imported = new KozmoyaAdapter().adapt(PAGE, {
      requestedId: "5027",
      sizeName: "Ürün Boyutu",
      pages: [page50, page150],
    })

    expect(imported.code).toBe("kz-2805")
    expect(imported.externalId).toBe("2805")
    expect(imported.name).toBe("American Crew Precision Shave Gel Tıraş Jeli")
    expect(imported.brand).toBe("American Crew")
    expect(imported.color).toBe("Standart")
    expect(imported.currency).toBe("TRY")
    expect(imported.attributes).toEqual([{ name: "Açıklama", value: "150 ml açıklaması" }])
    expect(imported.images).toEqual([
      "https://www.kozmoya.com/image/cache/catalog/ekfoto/669-800x800.webp",
      "https://www.kozmoya.com/image/cache/catalog/ekfoto/669-1-800x800.webp",
      "https://www.kozmoya.com/150.webp",
    ])
    expect(imported.variants).toEqual([
      {
        barcode: "669316406171",
        sku: "AC/SHAVE/GEL50",
        price: "180.00",
        compareAtPrice: "1240.00",
        attributes: [{ name: "Ürün Boyutu", value: "50ml" }],
        sortOrder: 0,
        inStock: true,
      },
      {
        barcode: "0669316406168",
        sku: "AC/SHAVE/GEL150",
        price: "1341.00",
        compareAtPrice: null,
        attributes: [{ name: "Ürün Boyutu", value: "150ml" }],
        sortOrder: 1,
        inStock: false,
      },
    ])
    expect(imported.colorUrls).toEqual([])
  })

  it("keeps the shop text of a product without other sizes", () => {
    const section = mainSection(simplePage)
    const imported = new KozmoyaAdapter().adapt(PAGE, {
      sizeName: null,
      pages: [{ productId: "5027", ld: productLd(simplePage), oldPrice: oldPrice(section), size: null }],
    })

    expect(imported.name).toBe("American Crew Precision Shave Gel 50ml")
    expect(imported.attributes).toEqual([
      { name: "Özellikler", value: "Şeffaf jel.\nCildi rahatlatır." },
      { name: "İçerik", value: "Aloe Vera" },
    ])
    expect(imported.variants[0]?.attributes).toEqual([])
  })

  it("drops the size from the product name", () => {
    expect(withoutSize("Tıraş Jeli 50ml", "50ml")).toBe("Tıraş Jeli")
    expect(withoutSize("Tıraş Jeli 50 ML - Mini", "50ml")).toBe("Tıraş Jeli - Mini")
    expect(withoutSize("Saç Boyası 60ml", "60 ml")).toBe("Saç Boyası")
    expect(withoutSize("Seri 150ml", "50ml")).toBe("Seri 150ml")
    expect(withoutSize("50ml", "50ml")).toBe("50ml")
  })

  it("maps option values to variants with their own barcode, price and stock", () => {
    const section = mainSection(optionPage)
    const imported = new KozmoyaAdapter().adapt("https://www.kozmoya.com/Loreal-Majirel-Sac-Boyasi-60ml", {
      sizeName: null,
      pages: [
        {
          productId: productId(optionPage),
          ld: optionLd,
          oldPrice: oldPrice(section),
          options: optionGroups(section),
          size: null,
        },
      ],
    })

    expect(imported.brand).toBe("L'Oréal Professionnel")
    expect(imported.variants).toEqual([
      {
        barcode: "3474637283261",
        sku: "LR_MJRL_1",
        price: "600.00",
        compareAtPrice: null,
        attributes: [{ name: "Majirel Ton", value: "1 - Siyah" }],
        sortOrder: 0,
        inStock: true,
      },
      {
        barcode: "3474637280642",
        sku: "LR_MJRL_4_8",
        price: "555.00",
        compareAtPrice: "850.00",
        attributes: [{ name: "Majirel Ton", value: "4.8 - Kahve Moka" }],
        sortOrder: 1,
        inStock: false,
      },
      {
        barcode: "kz-5358-9070",
        sku: null,
        price: "555.00",
        compareAtPrice: "850.00",
        attributes: [{ name: "Majirel Ton", value: "5.1 - Açık Kahve Küllü" }],
        sortOrder: 2,
        inStock: true,
      },
    ])
  })

  it("makes every colour a product with the sizes as variants", () => {
    const section = mainSection(optionPage)
    const colourLd = { ...optionLd, variesBy: ["https://schema.org/color"] }
    const page60 = {
      url: "https://www.kozmoya.com/Loreal-Majirel-Sac-Boyasi-60ml",
      productId: "5358",
      ld: colourLd,
      oldPrice: oldPrice(section),
      options: optionGroups(section),
      images: ["https://www.kozmoya.com/gallery-60.webp"],
      size: "60ml",
    }
    const page50 = {
      url: "https://www.kozmoya.com/Loreal-Majirel-Sac-Boyasi-50ml",
      productId: "165",
      ld: { "@type": "ProductGroup", name: "LOREAL Majirel Saç Boyası 50ml", offers: { price: 420 } },
      options: [
        {
          id: "1",
          name: "Majirel 50ml",
          values: [
            { id: "7", label: "4.8 -  Kahve Moka", barcode: "111", sku: "LR_50_4_8", stock: "var", images: [] },
          ],
        },
      ],
      size: "50ml",
    }
    const imported = new KozmoyaAdapter().adapt(
      "https://www.kozmoya.com/Loreal-Majirel-Sac-Boyasi-60ml-v-LR_MJRL_4_8",
      { requestedId: "5358", requestedSku: "LR_MJRL_4_8", sizeName: "Ürün Boyutu", pages: [page50, page60] }
    )

    expect(imported.code).toBe("kz-165")
    expect(imported.color).toBe("4.8 - Kahve Moka")
    expect(imported.name).toBe("LOREAL Majirel Saç Boyası - 4.8 - Kahve Moka")
    expect(imported.variants.map((variant) => [variant.barcode, variant.attributes, variant.price, variant.inStock])).toEqual([
      ["111", [{ name: "Ürün Boyutu", value: "50ml" }], "420.00", true],
      ["3474637280642", [{ name: "Ürün Boyutu", value: "60ml" }], "555.00", false],
    ])
    expect(imported.images).toEqual([
      "https://x/box-4.8.webp",
      "https://x/4.8-800.webp",
      "https://x/doku.webp",
      "https://x/sonuc.webp",
      "https://www.kozmoya.com/gallery-60.webp",
    ])
    expect(imported.colorUrls).toEqual(["https://www.kozmoya.com/Loreal-Majirel-Sac-Boyasi-60ml-v-LR_MJRL_1"])
  })

  it("picks the first colour for a plain link and refuses an unknown colour", () => {
    const section = mainSection(optionPage)
    const page = { productId: "5358", ld: optionLd, options: optionGroups(section).map((group) => ({ ...group, name: "Renk" })) }
    const adapter = new KozmoyaAdapter()

    expect(adapter.adapt("https://www.kozmoya.com/Majirel", { pages: [page] }).color).toBe("1 - Siyah")
    expect(() => adapter.adapt("https://www.kozmoya.com/Majirel-v-YOK", { requestedSku: "YOK", pages: [page] })).toThrow(
      "YOK renk seçeneği bulunamadı"
    )
  })

  it("keys variant links and product ids", () => {
    const adapter = new KozmoyaAdapter()

    expect(adapter.productKey("https://www.kozmoya.com/Loreal-Majirel-Sac-Boyasi-60ml")).toBe(
      adapter.productKey("https://kozmoya.com/loreal-majirel-sac-boyasi-60ml/")
    )
    expect(adapter.productKey("https://www.kozmoya.com/Loreal-Majirel-Sac-Boyasi-60ml-v-LR_MJRL_1")).not.toBe(
      adapter.productKey("https://www.kozmoya.com/Loreal-Majirel-Sac-Boyasi-60ml")
    )
    expect(adapter.productKey("https://www.kozmoya.com/index.php?route=product/product&product_id=5027")).toBe(
      "kozmoya:id:5027"
    )
  })

  it("refuses a link whose product id does not match", () => {
    expect(() =>
      new KozmoyaAdapter().adapt("https://www.kozmoya.com/index.php?route=product/product&product_id=1", {
        requestedId: "5027",
        pages: [{ productId: "5027", ld: { "@type": "Product", name: "x" } }],
      })
    ).toThrow("eşleşmiyor")
  })
})
