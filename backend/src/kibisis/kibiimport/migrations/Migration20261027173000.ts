import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261027173000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table if exists "kibiimport_job" add column if not exists "parent_id" text null;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_kibiimport_job_parent_id" ON "kibiimport_job" ("parent_id") WHERE deleted_at IS NULL;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_kibiimport_job_parent_id";`)
    this.addSql(`alter table if exists "kibiimport_job" drop column if exists "parent_id";`)
  }
}
