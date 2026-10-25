import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20261025085500 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `alter table if exists "kibinav_item" drop constraint if exists "kibinav_item_menu_check";`
    )
    this.addSql(
      `alter table if exists "kibinav_item" add constraint "kibinav_item_menu_check" check("menu" in ('main', 'footer', 'top', 'bottom'));`
    )
  }

  override async down(): Promise<void> {
    this.addSql(
      `alter table if exists "kibinav_item" drop constraint if exists "kibinav_item_menu_check";`
    )
    this.addSql(
      `alter table if exists "kibinav_item" add constraint "kibinav_item_menu_check" check("menu" in ('main', 'footer', 'top'));`
    )
  }
}
