import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261027113534 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "kibitranslate_memory" drop constraint if exists "kibitranslate_memory_hash_unique";`);
    this.addSql(`create table if not exists "kibitranslate_memory" ("id" text not null, "hash" text not null, "source_locale" text not null, "target_locale" text not null, "format" text not null default 'text', "source_text" text not null, "translated_text" text not null, "provider" text not null default '', "edited" boolean not null default false, "hits" integer not null default 0, "last_used_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "kibitranslate_memory_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_kibitranslate_memory_deleted_at" ON "kibitranslate_memory" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_kibitranslate_memory_hash_unique" ON "kibitranslate_memory" ("hash") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_kibitranslate_memory_source_locale_target_locale" ON "kibitranslate_memory" ("source_locale", "target_locale") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "kibitranslate_memory" cascade;`);
  }

}
