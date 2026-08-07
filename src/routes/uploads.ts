import { FastifyInstance } from "fastify";
import { randomUUID } from "crypto";
import {
  buildPublicUrl,
  createSignedUploadUrl,
  ensureStorageBucket,
} from "../plugins/storage";

export default async function uploadRoutes(fastify: FastifyInstance) {
  fastify.post("/upload-url", async (request, reply) => {
    const body = request.body as any;
    const fileName = body?.fileName || "upload";
    const contentType = body?.contentType || "application/octet-stream";

    const safeFileName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, "-");
    const objectName = `${Date.now()}-${randomUUID()}-${safeFileName}`;

    await ensureStorageBucket();
    const uploadUrl = await createSignedUploadUrl(objectName, contentType);

    return reply.send({
      bucket: process.env.MINIO_BUCKET || "ruumi",
      objectName,
      uploadUrl,
      publicUrl: buildPublicUrl(objectName),
      contentType,
    });
  });
}
