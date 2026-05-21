import { DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { getR2Env } from "@/config/server-env";
import { getVerifiedAdminApiClient } from "@/lib/api-auth";
import { noStoreJson } from "@/lib/http";
import { createR2Client } from "@/lib/r2";

function diagnosticError(error: unknown) {
  if (error instanceof Error) {
    const metadata = (error as Error & { $metadata?: { httpStatusCode?: number } })
      .$metadata;
    const status = metadata?.httpStatusCode ? ` (${metadata.httpStatusCode})` : "";

    return `${error.name}${status}: ${error.message}`;
  }

  return "Unknown R2 diagnostic error.";
}

export async function POST() {
  if (!(await getVerifiedAdminApiClient())) {
    return noStoreJson({ error: "Unauthorized." }, { status: 401 });
  }

  const client = createR2Client();
  const r2Env = getR2Env();
  const key = `diagnostics/server-${Date.now()}.txt`;

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: r2Env.bucket,
        Key: key,
        Body: `rxncor.studio R2 server diagnostic ${new Date().toISOString()}`,
        ContentType: "text/plain"
      })
    );
    await client.send(
      new DeleteObjectCommand({
        Bucket: r2Env.bucket,
        Key: key
      })
    );

    return noStoreJson({ ok: true, key });
  } catch (error) {
    return noStoreJson({ error: diagnosticError(error) }, { status: 500 });
  }
}
