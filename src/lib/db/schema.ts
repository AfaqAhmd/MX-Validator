import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const uploadStatusEnum = pgEnum("upload_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

export const uploads = pgTable("uploads", {
  id: uuid("id").defaultRandom().primaryKey(),
  filename: text("filename").notNull(),
  totalRows: integer("total_rows").notNull().default(0),
  processedRows: integer("processed_rows").notNull().default(0),
  status: uploadStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const leads = pgTable("leads", {
  id: serial("id").primaryKey(),
  uploadId: uuid("upload_id")
    .references(() => uploads.id, { onDelete: "cascade" })
    .notNull(),
  email: text("email").notNull(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  company: text("company"),
  title: text("title"),
  domain: text("domain").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const domains = pgTable("domains", {
  id: serial("id").primaryKey(),
  domain: text("domain").notNull().unique(),
  mxRecords: jsonb("mx_records").$type<MXRecord[]>(),
  hasMx: boolean("has_mx").notNull().default(false),
  faviconUrl: text("favicon_url"),
  securityGatewayName: text("security_gateway_name"),
  securityGatewayColor: text("security_gateway_color"),
  scannedAt: timestamp("scanned_at"),
});

export type Upload = typeof uploads.$inferSelect;
export type NewUpload = typeof uploads.$inferInsert;
export type Lead = typeof leads.$inferSelect;
export type NewLead = typeof leads.$inferInsert;
export type Domain = typeof domains.$inferSelect;
export type NewDomain = typeof domains.$inferInsert;

export interface MXRecord {
  priority: number;
  exchange: string;
  ttl: number;
}
