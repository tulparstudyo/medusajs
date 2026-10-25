import { FieldGroup, TextField } from "../fields"
import { SettingsFormProps } from "../settings-screen"
import {
  APP_LINK_LABELS,
  APP_LINKS,
  AppLink,
  SOCIAL_LINK_LABELS,
  SOCIAL_LINKS,
  SocialLink,
} from "../../types"

const PLACEHOLDERS: Record<SocialLink | AppLink, string> = {
  instagram: "https://www.instagram.com/hesabiniz",
  youtube: "https://www.youtube.com/@kanaliniz",
  tiktok: "https://www.tiktok.com/@hesabiniz",
  facebook: "https://www.facebook.com/sayfaniz",
  x: "https://x.com/hesabiniz",
  linkedin: "https://www.linkedin.com/company/sirketiniz",
  app_store: "https://apps.apple.com/tr/app/...",
  google_play: "https://play.google.com/store/apps/details?id=...",
  app_gallery: "https://appgallery.huawei.com/app/...",
}

export default function SocialForm({ values, onChange }: SettingsFormProps<"social">) {
  return (
    <>
      <FieldGroup
        title="Sosyal Medya ve Uygulamalar"
        description="Footer'daki Bizi Takip Edin bölümünde gösterilir. Boş bırakılan hesaplar gösterilmez."
      >
        {SOCIAL_LINKS.map((link) => (
          <TextField
            key={link}
            id={`social-${link}`}
            label={SOCIAL_LINK_LABELS[link]}
            placeholder={PLACEHOLDERS[link]}
            value={values[link]}
            onChange={(value) => onChange({ [link]: value })}
          />
        ))}
      </FieldGroup>
      <FieldGroup
        title="Uygulama mağazaları"
        description="Footer'daki Mobil Uygulamalar bölümünde gösterilir. Boş bırakılan mağazalar gösterilmez."
      >
        {APP_LINKS.map((link) => (
          <TextField
            key={link}
            id={`social-${link}`}
            label={APP_LINK_LABELS[link]}
            placeholder={PLACEHOLDERS[link]}
            value={values[link]}
            onChange={(value) => onChange({ [link]: value })}
          />
        ))}
      </FieldGroup>
    </>
  )
}
