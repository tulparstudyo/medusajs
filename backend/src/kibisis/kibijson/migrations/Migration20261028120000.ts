import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261028120000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "kibijson_batch" ("id" text not null, "name" text not null, "source" text not null, "schema" text not null, "payload_sha256" text not null, "image_base" text null, "status" text check ("status" in ('ready', 'queued', 'running', 'paused', 'completed', 'completed_with_errors', 'cancelled')) not null default 'ready', "category_id" text null, "location_ids" text[] null, "currency_code" text null, "options" jsonb null, "report" jsonb null, "total" integer not null default 0, "pending" integer not null default 0, "completed" integer not null default 0, "failed" integer not null default 0, "skipped" integer not null default 0, "created_by" text null, "started_at" timestamptz null, "finished_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "kibijson_batch_pkey" primary key ("id"));`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_kibijson_batch_deleted_at" ON "kibijson_batch" ("deleted_at") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_kibijson_batch_status_created_at" ON "kibijson_batch" ("status", "created_at") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_kibijson_batch_payload_sha256" ON "kibijson_batch" ("payload_sha256") WHERE deleted_at IS NULL;`)

    this.addSql(`create table if not exists "kibijson_item" ("id" text not null, "batch_id" text not null, "position" integer not null, "external_id" text not null, "code" text not null, "color" text not null, "title" text not null, "payload" jsonb not null, "payload_sha256" text not null, "fingerprint" text null, "category_ids" text[] null, "status" text check ("status" in ('pending', 'processing', 'completed', 'failed', 'skipped', 'cancelled')) not null default 'pending', "attempts" integer not null default 0, "max_attempts" integer not null default 3, "next_run_at" timestamptz null, "locked_until" timestamptz null, "locked_by" text null, "product_id" text null, "created" boolean null, "result" jsonb null, "warnings" jsonb null, "error" text null, "started_at" timestamptz null, "finished_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "kibijson_item_pkey" primary key ("id"));`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_kibijson_item_deleted_at" ON "kibijson_item" ("deleted_at") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_kibijson_item_status_next_run_at_created_at" ON "kibijson_item" ("status", "next_run_at", "created_at") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_kibijson_item_batch_id_position" ON "kibijson_item" ("batch_id", "position") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_kibijson_item_batch_id_code_color_unique" ON "kibijson_item" ("batch_id", "code", "color") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_kibijson_item_code_color_status" ON "kibijson_item" ("code", "color", "status") WHERE deleted_at IS NULL;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "kibijson_item" cascade;`)
    this.addSql(`drop table if exists "kibijson_batch" cascade;`)
  }
}
