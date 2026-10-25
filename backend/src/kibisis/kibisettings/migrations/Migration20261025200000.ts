import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261025200000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "kibisettings" ("id" text not null, "settings_key" text not null, "values" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "kibisettings_pkey" primary key ("id"));`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_kibisettings_deleted_at" ON "kibisettings" ("deleted_at") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_kibisettings_settings_key_unique" ON "kibisettings" ("settings_key") WHERE deleted_at IS NULL;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "kibisettings" cascade;`)
  }
}
