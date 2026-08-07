import { FastifyInstance } from "fastify";
import { readFileSync } from "fs";
import { join } from "path";

export default async function uiRoutes(fastify: FastifyInstance) {
  fastify.get("/", async (_request, reply) => {
    const html = readFileSync(
      join(process.cwd(), "public", "index.html"),
      "utf8",
    );
    return reply.type("text/html").send(html);
  });
}
