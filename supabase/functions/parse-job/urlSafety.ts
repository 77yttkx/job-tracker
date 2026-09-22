// SSRF-safety helpers for parse-job. Pure/dependency-free (aside from an
// optional, best-effort Deno.resolveDns lookup) so this module can be
// unit-tested directly under Vitest/Node as well as run under Deno.

const PRIVATE_IP_PATTERNS: RegExp[] = [
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./, // covers the 169.254.169.254 cloud metadata address
  /^::1$/,
  /^::$/,
  /^fc[0-9a-f]{2}:/i,
  /^fd[0-9a-f]{2}:/i,
  /^fe80:/i,
]

/** True for a hostname/IP literal that is loopback, private, link-local, or a known cloud metadata address. */
export function isPrivateAddressLiteral(host: string): boolean {
  const normalized = host.toLowerCase().replace(/^\[/, '').replace(/\]$/, '')
  if (normalized === 'localhost' || normalized.endsWith('.localhost')) return true
  if (normalized === 'metadata.google.internal') return true
  return PRIVATE_IP_PATTERNS.some((pattern) => pattern.test(normalized))
}

/**
 * Best-effort DNS-rebinding guard: resolves the hostname and checks whether
 * any resolved address is private. Uses Deno.resolveDns when available
 * (Supabase Edge Functions); elsewhere (e.g. under Vitest/Node) it falls
 * back to the literal-only check so the function is still testable and
 * never throws for lack of the API.
 */
export async function resolvesToPrivateAddress(hostname: string): Promise<boolean> {
  if (isPrivateAddressLiteral(hostname)) return true
  const denoGlobal = (globalThis as { Deno?: { resolveDns?: (h: string, t: string) => Promise<string[]> } }).Deno
  if (!denoGlobal?.resolveDns) return false
  try {
    const [ipv4, ipv6] = await Promise.all([
      denoGlobal.resolveDns(hostname, 'A').catch(() => [] as string[]),
      denoGlobal.resolveDns(hostname, 'AAAA').catch(() => [] as string[]),
    ])
    return [...ipv4, ...ipv6].some((ip) => isPrivateAddressLiteral(ip))
  } catch {
    return false
  }
}

export async function assertSafeUrl(url: URL): Promise<void> {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only http and https URLs are allowed.')
  }
  if (await resolvesToPrivateAddress(url.hostname)) {
    throw new Error('This URL points to a private, local, or cloud-metadata address and cannot be fetched.')
  }
}
