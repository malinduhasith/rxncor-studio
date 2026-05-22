type EnvName =
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  | "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  | "SUPABASE_SECRET_KEY"
  | "SUPABASE_SERVICE_ROLE_KEY"
  | "CLOUDFLARE_R2_ACCOUNT_ID"
  | "CLOUDFLARE_R2_ACCESS_KEY_ID"
  | "CLOUDFLARE_R2_SECRET_ACCESS_KEY"
  | "CLOUDFLARE_R2_BUCKET"
  | "CLOUDFLARE_R2_PUBLIC_BASE_URL"
  | "NEXT_PUBLIC_R2_PUBLIC_BASE_URL"
  | "RESEND_API_KEY"
  | "EMAIL_FROM"
  | "EMAIL_REPLY_TO"
  | "ADMIN_NOTIFICATION_EMAIL";

export function requiredEnv(name: EnvName) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

export function optionalEnv(name: EnvName) {
  return process.env[name] || undefined;
}

export function getSupabaseEnv() {
  return {
    url: requiredEnv("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey:
      optionalEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY") ??
      requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    serviceRoleKey:
      optionalEnv("SUPABASE_SECRET_KEY") ?? optionalEnv("SUPABASE_SERVICE_ROLE_KEY")
  };
}

export function getR2Env() {
  return {
    accountId: requiredEnv("CLOUDFLARE_R2_ACCOUNT_ID"),
    accessKeyId: requiredEnv("CLOUDFLARE_R2_ACCESS_KEY_ID"),
    secretAccessKey: requiredEnv("CLOUDFLARE_R2_SECRET_ACCESS_KEY"),
    bucket: requiredEnv("CLOUDFLARE_R2_BUCKET"),
    publicBaseUrl:
      optionalEnv("NEXT_PUBLIC_R2_PUBLIC_BASE_URL") ??
      optionalEnv("CLOUDFLARE_R2_PUBLIC_BASE_URL")
  };
}
