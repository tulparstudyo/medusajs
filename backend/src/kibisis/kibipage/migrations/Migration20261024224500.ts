import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261024224500 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "kibipage" ("id" text not null, "page_key" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "kibipage_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_kibipage_deleted_at" ON "kibipage" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_kibipage_page_key_unique" ON "kibipage" ("page_key") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "kibipage_section" ("id" text not null, "page_id" text not null, "type" text not null, "name" text not null default '', "position" integer not null default 0, "is_active" boolean not null default true, "settings" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "kibipage_section_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_kibipage_section_deleted_at" ON "kibipage_section" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_kibipage_section_page_id_position" ON "kibipage_section" ("page_id", "position") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "kibipage_section" cascade;`);
    this.addSql(`drop table if exists "kibipage" cascade;`);
  }

}
