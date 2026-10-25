import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261025173000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "kibigroup_product" ("id" text not null, "product_id" text not null, "main_code" text not null, "color" text not null, "color_hex" text null, "position" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "kibigroup_product_pkey" primary key ("id"));`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_kibigroup_product_deleted_at" ON "kibigroup_product" ("deleted_at") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_kibigroup_product_product_id_unique" ON "kibigroup_product" ("product_id") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_kibigroup_product_main_code" ON "kibigroup_product" ("main_code") WHERE deleted_at IS NULL;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "kibigroup_product" cascade;`)
  }
}
