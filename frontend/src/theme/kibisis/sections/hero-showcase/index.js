const DELAY = 5000

export function initHeroShowcase(root) {
  const stage = root.querySelector("[data-hero-stage]")
  if (!stage || stage.dataset.heroReady === "1") {
    return
  }

  stage.dataset.heroReady = "1"
  const slides = [...stage.querySelectorAll("[data-hero-slide]")]
  if (slides.length < 2) {
    return
  }

  const dots = stage.querySelector("[data-hero-dots]")
  let index = Math.max(
    0,
    slides.findIndex((slide) => slide.classList.contains("is-active"))
  )
  let timer = 0

  slides.forEach((_, slideIndex) => {
    const button = document.createElement("button")
    button.type = "button"
    button.className = "kibi-hero__dot"
    button.setAttribute("aria-label", `${stage.dataset.dotLabel || "Slide"} ${slideIndex + 1}`)
    button.addEventListener("click", () => show(slideIndex))
    dots?.appendChild(button)
  })

  const show = (next) => {
    index = (next + slides.length) % slides.length
    slides.forEach((slide, slideIndex) => {
      slide.classList.toggle("is-active", slideIndex === index)
    })
    dots?.querySelectorAll(".kibi-hero__dot").forEach((dot, dotIndex) => {
      dot.classList.toggle("is-active", dotIndex === index)
    })
  }

  const start = () => {
    window.clearInterval(timer)
    timer = window.setInterval(() => show(index + 1), DELAY)
  }

  show(index)
  start()
  stage.addEventListener("pointerenter", () => window.clearInterval(timer))
  stage.addEventListener("pointerleave", start)
}
