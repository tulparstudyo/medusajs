const DRAG_THRESHOLD = 6

export function initQuickCategories(root) {
  const track = root.querySelector("[data-qc-track]")
  if (!track || track.dataset.qcReady === "1") {
    return
  }

  track.dataset.qcReady = "1"

  let startX = 0
  let startScroll = 0
  let dragged = false

  track.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse" || event.button !== 0) {
      return
    }

    dragged = false
    startX = event.clientX
    startScroll = track.scrollLeft
    track.setPointerCapture(event.pointerId)
  })

  track.addEventListener("pointermove", (event) => {
    if (!track.hasPointerCapture(event.pointerId)) {
      return
    }

    const delta = event.clientX - startX
    if (Math.abs(delta) > DRAG_THRESHOLD) {
      dragged = true
      track.classList.add("is-dragging")
    }

    track.scrollLeft = startScroll - delta
  })

  const end = (event) => {
    if (track.hasPointerCapture(event.pointerId)) {
      track.releasePointerCapture(event.pointerId)
    }

    track.classList.remove("is-dragging")
  }

  track.addEventListener("pointerup", end)
  track.addEventListener("pointercancel", end)
  track.addEventListener("click", (event) => {
    if (!dragged) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    dragged = false
  })
}
