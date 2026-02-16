export function getPublicStorageUrl(
  bucket: string,
  path: string,
  updatedAt?: string
): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing");
  }
  const normalizedBase = base.replace(/\/+$/, "");
  const normalizedPath = path.replace(/^\/+/, "");
  const publicUrl = `${normalizedBase}/storage/v1/object/public/${bucket}/${normalizedPath}`;
  const version = updatedAt ? encodeURIComponent(updatedAt) : "0";
  return `${publicUrl}?v=${version}`;
}
