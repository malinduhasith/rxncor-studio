import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Env } from "@/config/server-env";

export function createR2Client() {
  const r2Env = getR2Env();

  return new S3Client({
    region: "auto",
    endpoint: `https://${r2Env.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: r2Env.accessKeyId,
      secretAccessKey: r2Env.secretAccessKey
    }
  });
}

export function albumObjectKey(
  slug: string,
  kind: "thumbnails" | "previews" | "full" | "zip",
  filename: string
) {
  return `albums/${slug}/${kind}/${filename}`;
}

export async function createUploadUrl(key: string, contentType: string) {
  const client = createR2Client();
  const r2Env = getR2Env();
  const command = new PutObjectCommand({
    Bucket: r2Env.bucket,
    Key: key,
    ContentType: contentType
  });

  return getSignedUrl(client, command, { expiresIn: 60 * 10 });
}

export async function createDownloadUrl(key: string) {
  const client = createR2Client();
  const r2Env = getR2Env();
  const command = new GetObjectCommand({
    Bucket: r2Env.bucket,
    Key: key
  });

  return getSignedUrl(client, command, { expiresIn: 60 * 15 });
}

export function publicR2Url(key: string) {
  const r2Env = getR2Env();

  if (!r2Env.publicBaseUrl) {
    return "";
  }

  return `${r2Env.publicBaseUrl.replace(/\/$/, "")}/${key}`;
}
