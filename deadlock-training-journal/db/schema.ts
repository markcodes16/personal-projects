import { sqliteTable, text, primaryKey } from "drizzle-orm/sqlite-core";
export const records = sqliteTable("training_records", {
 userId: text("user_id").notNull(), kind: text("kind").notNull(), id: text("id").notNull(), data: text("data").notNull(), updatedAt: text("updated_at").notNull()
}, t => [primaryKey({columns:[t.userId,t.kind,t.id]})]);
