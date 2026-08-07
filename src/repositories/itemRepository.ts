import { randomUUID } from "crypto";
import { pool } from "../plugins/db";
import {
  deleteCachedKey,
  getCachedJson,
  setCachedJson,
} from "../plugins/redis";

export type CreateItemInput = {
  title: string;
  description?: string;
  price: number;
  category?: string;
  location?: string;
  sellerId: string;
  images?: string[];
};

export type ItemSearchFilters = {
  query?: string;
  category?: string;
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  limit?: number;
  cursor?: string;
};

function encodeCursor(createdAt: string, id: string) {
  return Buffer.from(`${createdAt}|${id}`).toString("base64");
}

function decodeCursor(cursor: string) {
  try {
    const decoded = Buffer.from(cursor, "base64").toString("utf8");
    const [createdAt, id] = decoded.split("|");
    if (!createdAt || !id) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

export const createItem = async (input: CreateItemInput) => {
  const itemId = randomUUID();
  const createdAt = new Date().toISOString();
  const updatedAt = createdAt;
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const safeSellerId = input.sellerId || "anonymous";
    const sellerEmail = `${safeSellerId.replace(/[^a-zA-Z0-9]/g, "-")}@local.test`;

    await client.query(
      `INSERT INTO users (id, name, email, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (id) DO NOTHING`,
      [safeSellerId, safeSellerId, sellerEmail, createdAt, updatedAt],
    );

    await client.query(
      `INSERT INTO items (id, title, description, price, category, location, seller_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        itemId,
        input.title,
        input.description || null,
        input.price,
        input.category || null,
        input.location || null,
        safeSellerId,
        createdAt,
        updatedAt,
      ],
    );

    const images = input.images || [];
    if (images.length > 0) {
      const values = images
        .map(
          (_, index) =>
            `($${index * 3 + 1}, $${index * 3 + 2}, $${index * 3 + 3})`,
        )
        .join(", ");
      const params = images.flatMap((url) => [randomUUID(), itemId, url]);
      await client.query(
        `INSERT INTO item_images (id, item_id, url) VALUES ${values}`,
        params,
      );
    }

    await client.query("COMMIT");
    await deleteCachedKey("items:*");
    return findItemById(itemId);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const findItemById = async (id: string) => {
  const result = await pool.query(
    `SELECT
       i.id,
       i.title,
       i.description,
       i.price,
       i.category,
       i.location,
       i.created_at AS "createdAt",
       i.updated_at AS "updatedAt",
       json_build_object(
         'id', u.id,
         'name', u.name
       ) AS seller,
       COALESCE(
         json_agg(json_build_object('id', ii.id, 'url', ii.url))
         FILTER (WHERE ii.id IS NOT NULL),
         '[]'
       ) AS images
     FROM items i
     JOIN users u ON u.id = i.seller_id
     LEFT JOIN item_images ii ON ii.item_id = i.id
     WHERE i.id = $1
     GROUP BY i.id, u.id`,
    [id],
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0];
};

export const searchItems = async (filters: ItemSearchFilters) => {
  const limit = Math.min(filters.limit ?? 20, 50);
  const cacheKey = `items:${JSON.stringify({
    query: filters.query || null,
    category: filters.category || null,
    location: filters.location || null,
    minPrice: filters.minPrice ?? null,
    maxPrice: filters.maxPrice ?? null,
    limit,
    cursor: filters.cursor || null,
  })}`;

  const cached = await getCachedJson<{ items: any[]; nextCursor?: string }>(
    cacheKey,
  );
  if (cached) {
    return cached;
  }

  const conditions: string[] = ["TRUE"];
  const values: any[] = [];

  if (filters.query) {
    const q = `%${filters.query}%`;
    values.push(q, q);
    conditions.push(
      `(i.title ILIKE $${values.length - 1} OR i.description ILIKE $${values.length})`,
    );
  }

  if (filters.category) {
    values.push(filters.category);
    conditions.push(`i.category ILIKE $${values.length}`);
  }

  if (filters.location) {
    values.push(filters.location);
    conditions.push(`i.location ILIKE $${values.length}`);
  }

  if (typeof filters.minPrice === "number") {
    values.push(filters.minPrice);
    conditions.push(`i.price >= $${values.length}`);
  }

  if (typeof filters.maxPrice === "number") {
    values.push(filters.maxPrice);
    conditions.push(`i.price <= $${values.length}`);
  }

  const cursor = filters.cursor ? decodeCursor(filters.cursor) : null;
  if (cursor) {
    values.push(cursor.createdAt, cursor.id);
    conditions.push(
      `(i.created_at < $${values.length - 1} OR (i.created_at = $${values.length - 1} AND i.id < $${values.length}))`,
    );
  }

  values.push(limit + 1);

  const result = await pool.query(
    `SELECT
       i.id,
       i.title,
       i.description,
       i.price,
       i.category,
       i.location,
       i.created_at AS "createdAt",
       i.updated_at AS "updatedAt",
       json_build_object(
         'id', u.id,
         'name', u.name
       ) AS seller,
       COALESCE(
         json_agg(json_build_object('id', ii.id, 'url', ii.url))
         FILTER (WHERE ii.id IS NOT NULL),
         '[]'
       ) AS images
     FROM items i
     JOIN users u ON u.id = i.seller_id
     LEFT JOIN item_images ii ON ii.item_id = i.id
     WHERE ${conditions.join(" AND ")}
     GROUP BY i.id, u.id
     ORDER BY i.created_at DESC, i.id DESC
     LIMIT $${values.length}`,
    values,
  );

  const rows = result.rows;
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore
    ? encodeCursor(rows[limit].createdAt, rows[limit].id)
    : undefined;

  const resultPayload = {
    items,
    nextCursor,
  };

  await setCachedJson(cacheKey, resultPayload, 60);
  return resultPayload;
};
