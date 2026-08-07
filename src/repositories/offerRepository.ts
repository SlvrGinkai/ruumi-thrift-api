import { randomUUID } from "crypto";
import { pool } from "../plugins/db";

export type CreateOfferInput = {
  itemId: string;
  buyerId: string;
  amount: number;
};

const allowedTransitions: Record<string, string[]> = {
  PENDING: ["ACCEPTED", "REJECTED", "COUNTERED"],
  COUNTERED: ["ACCEPTED", "REJECTED"],
  ACCEPTED: ["LOCKED"],
  LOCKED: ["COMPLETED"],
};

export const createOffer = async (input: CreateOfferInput) => {
  const offerId = randomUUID();
  const createdAt = new Date().toISOString();
  const updatedAt = createdAt;

  const item = await pool.query("SELECT id FROM items WHERE id = $1", [
    input.itemId,
  ]);
  if (item.rowCount === 0) {
    throw new Error("Item not found");
  }

  const safeBuyerId = input.buyerId || "anonymous-buyer";
  const buyerEmail = `${safeBuyerId.replace(/[^a-zA-Z0-9]/g, "-")}@local.test`;

  await pool.query(
    `INSERT INTO users (id, name, email, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO NOTHING`,
    [safeBuyerId, safeBuyerId, buyerEmail, createdAt, updatedAt],
  );

  const result = await pool.query(
    `INSERT INTO offers (id, item_id, buyer_id, amount, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'PENDING', $5, $6)
     RETURNING *`,
    [offerId, input.itemId, safeBuyerId, input.amount, createdAt, updatedAt],
  );

  return result.rows[0];
};

export const updateOfferStatus = async (
  offerId: string,
  action: string,
  counterAmount?: number,
) => {
  const offerResult = await pool.query(
    "SELECT id, status FROM offers WHERE id = $1",
    [offerId],
  );
  if (offerResult.rowCount === 0) {
    throw new Error("Offer not found");
  }

  const offer = offerResult.rows[0];
  const currentStatus = offer.status;
  const nextStatus = action.toUpperCase();

  if (!allowedTransitions[currentStatus]?.includes(nextStatus)) {
    throw new Error(
      `Invalid transition from ${currentStatus} to ${nextStatus}`,
    );
  }

  if (nextStatus === "COUNTERED" && typeof counterAmount !== "number") {
    throw new Error("counterAmount is required for COUNTERED");
  }

  const updatedAt = new Date().toISOString();

  const query =
    nextStatus === "COUNTERED"
      ? `UPDATE offers SET status = $1, amount = $2, updated_at = $3 WHERE id = $4 RETURNING *`
      : `UPDATE offers SET status = $1, updated_at = $2 WHERE id = $3 RETURNING *`;

  const params =
    nextStatus === "COUNTERED"
      ? [nextStatus, counterAmount, updatedAt, offerId]
      : [nextStatus, updatedAt, offerId];

  const updated = await pool.query(query, params);
  return updated.rows[0];
};
