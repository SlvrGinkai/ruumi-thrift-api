import { Client } from "minio";

const endpoint = process.env.MINIO_ENDPOINT || "localhost";
const port = Number(process.env.MINIO_PORT || "9000");
const useSSL = process.env.MINIO_USE_SSL === "true";
const accessKey = process.env.MINIO_ACCESS_KEY || "ruumi_minio";
const secretKey = process.env.MINIO_SECRET_KEY || "ruumi_minio_secret";
const bucket = process.env.MINIO_BUCKET || "ruumi";
const publicBaseUrl =
  process.env.MINIO_PUBLIC_URL || `http://${endpoint}:${port}`;

export const minioClient = new Client({
  endPoint: endpoint,
  port,
  useSSL,
  accessKey,
  secretKey,
});

export async function ensureStorageBucket() {
  const exists = await minioClient.bucketExists(bucket);
  if (!exists) {
    await minioClient.makeBucket(bucket);
  }
  return bucket;
}

export async function createSignedUploadUrl(
  objectName: string,
  contentType: string,
) {
  await ensureStorageBucket();
  return minioClient.presignedPutObject(bucket, objectName, 5 * 60);
}

export function buildPublicUrl(objectName: string) {
  return `${publicBaseUrl}/${bucket}/${encodeURIComponent(objectName)}`;
}
