import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261025144500 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`create table if not exists "kibiimport_job" ("id" text not null, "url" text not null, "category_id" text not null, "status" text check ("status" in ('pending', 'processing', 'completed', 'failed')) not null default 'pending', "result" text null, "exit_code" integer null, "started_at" timestamptz null, "finished_at" timestamptz null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "kibiimport_job_pkey" primary key ("id"));`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_kibiimport_job_deleted_at" ON "kibiimport_job" ("deleted_at") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_kibiimport_job_status_created_at" ON "kibiimport_job" ("status", "created_at") WHERE deleted_at IS NULL;`)

    this.addSql(`create table if not exists "kibiimport_product" ("id" text not null, "source" text not null, "code" text not null, "color" text not null, "product_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "kibiimport_product_pkey" primary key ("id"));`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_kibiimport_product_deleted_at" ON "kibiimport_product" ("deleted_at") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_kibiimport_product_code_color_unique" ON "kibiimport_product" ("code", "color") WHERE deleted_at IS NULL;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_kibiimport_product_product_id" ON "kibiimport_product" ("product_id") WHERE deleted_at IS NULL;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "kibiimport_product" cascade;`)
    this.addSql(`drop table if exists "kibiimport_job" cascade;`)
  }
}
