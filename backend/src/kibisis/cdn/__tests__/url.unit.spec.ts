import {
  cdnUrl,
  resolveCdnUrl,
  stripCdnUrl,
  transformPayloadCdnUrls,
  transformSectionSettingsCdn,
} from "../url"

describe("kibisis cdn url helpers", () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv, CDN_URL: "http://localhost:9080" }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it("reads the configured CDN_URL without trailing slash", () => {
    process.env.CDN_URL = "https://cdn.kibisis.com/"
    expect(cdnUrl()).toBe("https://cdn.kibisis.com")
  })

  it("strips CDN_URL from uploaded and imported image urls", () => {
    expect(stripCdnUrl("http://localhost:9080/products/2026-10/ty-1-1.webp")).toBe(
      "/products/2026-10/ty-1-1.webp"
    )
    expect(stripCdnUrl("http://localhost:9080/173000-photo.jpg")).toBe("/173000-photo.jpg")
    expect(stripCdnUrl("/products/2026-10/ty-1-1.webp")).toBe("/products/2026-10/ty-1-1.webp")
    expect(stripCdnUrl("https://images.external.test/photo.jpg")).toBe(
      "https://images.external.test/photo.jpg"
    )
  })

  it("resolves relative paths with the current CDN_URL from env", () => {
    process.env.CDN_URL = "https://cdn.newdomain.com"
    expect(resolveCdnUrl("/products/2026-10/ty-1-1.webp")).toBe(
      "https://cdn.newdomain.com/products/2026-10/ty-1-1.webp"
    )
    expect(resolveCdnUrl("/sections/sec_1/123-banner.png")).toBe(
      "https://cdn.newdomain.com/sections/sec_1/123-banner.png"
    )
    expect(resolveCdnUrl("https://images.external.test/photo.jpg")).toBe(
      "https://images.external.test/photo.jpg"
    )
  })

  it("strips and resolves section settings without touching navigation hrefs or icon names", () => {
    const raw = {
      slides: [
        { id: "s1", image: "http://localhost:9080/sections/sec_1/hero.webp", href: "/categories/kadin" },
      ],
      items: [
        { id: "i1", label: "Marka", href: "/", icon: "http://localhost:9080/sections/sec_1/logo.png" },
        { id: "i2", label: "Yeni", href: "/store", icon: "sparkles" },
      ],
      html: '<p><img src="http://localhost:9080/sections/sec_1/inline.jpg" alt="" /><a href="/about">Hakkımızda</a></p>',
    }

    const stripped = transformSectionSettingsCdn(raw, "strip")
    expect(stripped).toEqual({
      slides: [
        { id: "s1", image: "/sections/sec_1/hero.webp", href: "/categories/kadin" },
      ],
      items: [
        { id: "i1", label: "Marka", href: "/", icon: "/sections/sec_1/logo.png" },
        { id: "i2", label: "Yeni", href: "/store", icon: "sparkles" },
      ],
      html: '<p><img src="/sections/sec_1/inline.jpg" alt="" /><a href="/about">Hakkımızda</a></p>',
    })

    process.env.CDN_URL = "https://cdn.yenidomain.com"
    const resolved = transformSectionSettingsCdn(stripped, "resolve")
    expect(resolved).toEqual({
      slides: [
        { id: "s1", image: "https://cdn.yenidomain.com/sections/sec_1/hero.webp", href: "/categories/kadin" },
      ],
      items: [
        { id: "i1", label: "Marka", href: "/", icon: "https://cdn.yenidomain.com/sections/sec_1/logo.png" },
        { id: "i2", label: "Yeni", href: "/store", icon: "sparkles" },
      ],
      html: '<p><img src="https://cdn.yenidomain.com/sections/sec_1/inline.jpg" alt="" /><a href="/about">Hakkımızda</a></p>',
    })
  })

  it("strips and resolves product, variant, cart, and upload payloads", () => {
    const incoming = {
      title: "Test Ürün",
      handle: "test-urun",
      thumbnail: "http://localhost:9080/173000-thumb.jpg",
      images: [
        { url: "http://localhost:9080/173000-thumb.jpg" },
        { url: "http://localhost:9080/products/2026-10/ty-1-2.webp" },
      ],
      variants: [
        { title: "S", thumbnail: "http://localhost:9080/173000-var.jpg" },
      ],
    }

    const stored = transformPayloadCdnUrls(incoming, "strip")
    expect(stored).toEqual({
      title: "Test Ürün",
      handle: "test-urun",
      thumbnail: "/173000-thumb.jpg",
      images: [
        { url: "/173000-thumb.jpg" },
        { url: "/products/2026-10/ty-1-2.webp" },
      ],
      variants: [
        { title: "S", thumbnail: "/173000-var.jpg" },
      ],
    })

    process.env.CDN_URL = "https://cdn.yenidomain.com"
    const outgoing = transformPayloadCdnUrls({ product: stored }, "resolve")
    expect(outgoing).toEqual({
      product: {
        title: "Test Ürün",
        handle: "test-urun",
        thumbnail: "https://cdn.yenidomain.com/173000-thumb.jpg",
        images: [
          { url: "https://cdn.yenidomain.com/173000-thumb.jpg" },
          { url: "https://cdn.yenidomain.com/products/2026-10/ty-1-2.webp" },
        ],
        variants: [
          { title: "S", thumbnail: "https://cdn.yenidomain.com/173000-var.jpg" },
        ],
      },
    })
  })
})

