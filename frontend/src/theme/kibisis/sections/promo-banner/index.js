export function initPromoBanner(root) {
  if (!root.classList.contains("kibi-banner--slider") || root.dataset.bannerReady === "1") {
    return
  }

  const track = root.querySelector("[data-banner-track]")
  if (!(track instanceof HTMLElement)) {
    return
  }

  root.dataset.bannerReady = "1"

  const scrollByItem = (direction) => {
    const item = track.querySelector(".kibi-banner__item")
    const width = item instanceof HTMLElement ? item.getBoundingClientRect().width : track.clientWidth
    const gap = Number.parseFloat(getComputedStyle(track).columnGap || "0") || 0
    track.scrollBy({ left: direction * (width + gap), behavior: "smooth" })
  }

  root.querySelector("[data-banner-prev]")?.addEventListener("click", () => scrollByItem(-1))
  root.querySelector("[data-banner-next]")?.addEventListener("click", () => scrollByItem(1))
}
