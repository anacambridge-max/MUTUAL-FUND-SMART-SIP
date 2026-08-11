import { date, integer, jsonb, numeric, pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const dashboardSettings = pgTable("dashboard_settings", {
  id: integer("id").primaryKey().default(1),
  marketDataProvider: text("market_data_provider").notNull().default("nse"),
  strategicWeight: numeric("strategic_weight", { precision: 5, scale: 2 }).notNull().default("60.00"),
  opportunityWeight: numeric("opportunity_weight", { precision: 5, scale: 2 }).notNull().default("40.00"),
  tacticalTopupAmount: numeric("tactical_topup_amount", { precision: 12, scale: 2 }),
  fundMappings: jsonb("fund_mappings").$type<Record<string, unknown>[]>().notNull().default(sql`'[]'::jsonb`),
  proxyDefinitions: jsonb("proxy_definitions").$type<Record<string, unknown>[]>().notNull().default(sql`'[]'::jsonb`),
  updatedAt: timestamp("updated_at", { withTimezone: false }).notNull().defaultNow(),
});

export const fundNavHistory = pgTable(
  "fund_nav_history",
  {
    id: serial("id").primaryKey(),
    fundCode: text("fund_code").notNull(),
    fundName: text("fund_name").notNull(),
    navDate: date("nav_date").notNull(),
    nav: numeric("nav", { precision: 12, scale: 4 }).notNull(),
    source: text("source").notNull().default("amfi"),
    createdAt: timestamp("created_at", { withTimezone: false }).notNull().defaultNow(),
  },
  (table) => ({
    fundDateUnique: uniqueIndex("fund_nav_history_fund_date_uq").on(table.fundCode, table.navDate),
  }),
);

export const dashboardSnapshots = pgTable("dashboard_snapshots", {
  id: serial("id").primaryKey(),
  snapshotKey: text("snapshot_key").notNull().unique().default("latest"),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: false }).notNull().defaultNow(),
});
