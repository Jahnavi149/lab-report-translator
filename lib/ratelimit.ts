// Best-effort per-IP limiter for the endpoints that spend Muse quota.
// In-memory, so on serverless hosts it limits per warm instance rather than globally; it still stops
// casual abuse of a public demo URL. Put a real limiter (e.g. platform WAF) in front for production.
const hits = new Map<string, number[]>();

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return (fwd?.split(',')[0] ?? req.headers.get('x-real-ip') ?? 'local').trim();
}

export function rateLimited(req: Request, bucket: string, max = 20, windowMs = 10 * 60 * 1000): boolean {
  const now = Date.now();
  const key = `${bucket}:${clientIp(req)}`;
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) { hits.set(key, recent); return true; }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= windowMs)) hits.delete(k);
  return false;
}
