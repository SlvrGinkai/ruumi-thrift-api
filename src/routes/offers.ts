import { FastifyInstance } from "fastify";
import * as offerRepo from "../repositories/offerRepository";

export default async function offersRoutes(fastify: FastifyInstance) {
  fastify.post("/items/:itemId/offers", async (request, reply) => {
    const itemId = (request.params as any).itemId;
    const body = request.body as any;
    try {
      const offer = await offerRepo.createOffer({
        itemId,
        buyerId: body.buyerId,
        amount: body.amount,
      });
      return reply.code(201).send(offer);
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: "Failed to create offer" });
    }
  });

  fastify.patch("/offers/:offerId", async (request, reply) => {
    const offerId = (request.params as any).offerId;
    const body = request.body as any;
    try {
      const updated = await offerRepo.updateOfferStatus(
        offerId,
        body.action,
        body.counterAmount,
      );
      return reply.send(updated);
    } catch (err) {
      request.log.error(err);
      return reply
        .code(400)
        .send({ error: err instanceof Error ? err.message : "Invalid action" });
    }
  });
}
