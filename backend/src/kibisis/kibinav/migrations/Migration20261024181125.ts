import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261024181125 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "kibinav_item" ("id" text not null, "menu" text check ("menu" in ('main', 'footer')) not null default 'main', "label" text not null, "parent_id" text null, "position" integer not null default 0, "target_type" text check ("target_type" in ('category', 'url', 'anchor')) not null, "category_id" text null, "url" text null, "anchor" text null, "new_tab" boolean not null default false, "is_active" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "kibinav_item_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_kibinav_item_deleted_at" ON "kibinav_item" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_kibinav_item_menu_parent_id_position" ON "kibinav_item" ("menu", "parent_id", "position") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "kibinav_item" cascade;`);
  }

}
