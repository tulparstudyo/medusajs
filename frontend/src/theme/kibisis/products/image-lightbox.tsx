"use client"

import Lightbox from "yet-another-react-lightbox"
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails"
import Zoom from "yet-another-react-lightbox/plugins/zoom"
import "yet-another-react-lightbox/styles.css"
import "yet-another-react-lightbox/plugins/thumbnails.css"

import { useT } from "../i18n/client"

export default function ImageLightbox({
  images,
  index,
  open,
  title,
  onClose,
  onIndex,
}: {
  images: { id: string; url: string }[]
  index: number
  open: boolean
  title: string
  onClose: () => void
  onIndex: (index: number) => void
}) {
  const t = useT()
  const multiple = images.length > 1

  return (
    <Lightbox
      open={open}
      close={onClose}
      index={index}
      slides={images.map((image) => ({ src: image.url, alt: title }))}
      on={{ view: ({ index: next }) => onIndex(next) }}
      plugins={multiple ? [Zoom, Thumbnails] : [Zoom]}
      carousel={{ finite: true, imageFit: "contain" }}
      controller={{ closeOnBackdropClick: true }}
      zoom={{ maxZoomPixelRatio: 2, scrollToZoom: true }}
      thumbnails={{
        width: 56,
        height: 84,
        border: 2,
        borderRadius: 8,
        padding: 0,
        gap: 8,
        imageFit: "contain",
        vignette: false,
      }}
      labels={{
        Previous: t("product.previous_image"),
        Next: t("product.next_image"),
        Close: t("product.gallery_close"),
        Lightbox: t("product.gallery"),
        "Photo gallery": t("product.gallery"),
        Thumbnails: t("product.gallery_thumbnails"),
        "Zoom in": t("product.gallery_zoom_in"),
        "Zoom out": t("product.gallery_zoom_out"),
      }}
      styles={{
        container: { backgroundColor: "rgba(15, 23, 42, 0.95)" },
        thumbnailsContainer: { backgroundColor: "rgba(15, 23, 42, 0.95)" },
        thumbnail: { backgroundColor: "#f1f5f9", borderColor: "transparent" },
      }}
    />
  )
}
