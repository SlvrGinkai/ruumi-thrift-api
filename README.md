# Image storage approach

For this marketplace API, images should be stored in object storage (MinIO/S3) rather than the application server.

## Recommended flow

1. The client requests a pre-signed upload URL from the API.
2. The client uploads the file directly to MinIO/S3.
3. The API stores the returned public URL in the item record.
4. The frontend serves the image from the storage URL, which scales far better than writing files to the app container.

## Why this works

- Upload once, serve thousands of times
- Better horizontal scaling
- No disk bloat on app servers
- Easy CDN integration later

## Local setup

- MinIO is already included in docker-compose.yml
- Set the following environment variables:
  - MINIO_ENDPOINT
  - MINIO_PORT
  - MINIO_ACCESS_KEY
  - MINIO_SECRET_KEY
  - MINIO_BUCKET
  - MINIO_PUBLIC_URL

## Next step

Replace the current simple `images` array input with a signed-upload endpoint and store the returned public object URL in the item record.
