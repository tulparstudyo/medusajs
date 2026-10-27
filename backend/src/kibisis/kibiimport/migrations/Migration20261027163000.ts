import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261027163000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table if exists "kibiimport_job" add column if not exists "location_ids" text[] null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "kibiimport_job" drop column if exists "location_ids";`)
  }
}
