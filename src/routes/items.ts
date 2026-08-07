import { FastifyInstance } from "fastify";
import * as itemRepo from "../repositories/itemRepository";

export default async function itemsRoutes(fastify: FastifyInstance) {
  fastify.post("/items", async (request, reply) => {
    const body = request.body as any;
    try {
      const item = await itemRepo.createItem({
        title: body.title,
        description: body.description,
        price: body.price,
        category: body.category,
        location: body.location,
        sellerId: body.sellerId,
        images: body.images,
      });
      return reply.code(201).send(item);
    } catch (err) {
      request.log.error(err);
      return reply.code(500).send({ error: "Failed to create item" });
    }
  });

  fastify.get("/items", async (request, reply) => {
    const query = request.query as any;
    const limit = query.limit ? Number(query.limit) : undefined;
    const minPrice = query.minPrice ? Number(query.minPrice) : undefined;
    const maxPrice = query.maxPrice ? Number(query.maxPrice) : undefined;

    const result = await itemRepo.searchItems({
      query: query.q,
      category: query.category,
      location: query.location,
      minPrice,
      maxPrice,
      limit,
      cursor: query.cursor,
    });

    return result;
  });

  fastify.get("/items/:id", async (request, reply) => {
    const id = (request.params as any).id;
    const item = await itemRepo.findItemById(id);
    if (!item) return reply.code(404).send({ error: "Not found" });
    return item;
  });
}
