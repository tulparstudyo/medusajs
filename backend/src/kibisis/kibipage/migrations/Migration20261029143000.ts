import { Migration } from "@medusajs/framework/mikro-orm/migrations"

const DEFAULT_PAGES: ReadonlyArray< readonly [string, string] > = [
  ["home", "Ana Sayfa"],
  ["product", "Ürün Detay"],
  ["cookiepolicy", "Çerez Politikası"],
  ["privacy", "Gizlilik Politikası"],
  ["terms", "Kullanım Koşulları"],
  ["contact", "İletişim"],
  ["about", "Hakkımızda"],
  ["faq", "S.S.S."],
  ["careers", "İş İlanları"],
]

export class Migration20261029143000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "kibipage" add column if not exists "label" text not null default '';`
    )

    for (const [key, label] of DEFAULT_PAGES) {
      this.addSql(
        `update "kibipage" set "label" = '${label}' where "page_key" = '${key}' and ("label" = '' or "label" is null);`
      )
      this.addSql(
        `insert into "kibipage" ("id", "page_key", "label", "created_at", "updated_at")
         select 'kpage_default_${key}', '${key}', '${label}', now(), now()
         where not exists (
           select 1 from "kibipage" where "page_key" = '${key}' and "deleted_at" is null
         );`
      )
    }
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "kibipage" drop column if exists "label";`)
  }
}

