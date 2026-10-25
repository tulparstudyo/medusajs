import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261024183718 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "kibinav_item" drop constraint if exists "kibinav_item_menu_check";`);

    this.addSql(`alter table if exists "kibinav_item" add column if not exists "align" text check ("align" in ('start', 'end')) not null default 'start';`);
    this.addSql(`alter table if exists "kibinav_item" add constraint "kibinav_item_menu_check" check("menu" in ('main', 'footer', 'top'));`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "kibinav_item" drop constraint if exists "kibinav_item_menu_check";`);

    this.addSql(`alter table if exists "kibinav_item" drop column if exists "align";`);

    this.addSql(`alter table if exists "kibinav_item" add constraint "kibinav_item_menu_check" check("menu" in ('main', 'footer'));`);
  }

}
