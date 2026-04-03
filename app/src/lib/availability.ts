export type AvailabilityStatus = 'available' | 'taken' | 'unknown' | 'checking';

/**
 * Check domain availability via RDAP (rdap.org proxy — CORS-friendly, no key needed).
 * 404 = domain not found in registry = likely available.
 * 200 = domain is registered = taken.
 * Other errors (network, unsupported TLD) = unknown.
 */
export async function checkAvailability(domain: string): Promise<AvailabilityStatus> {
  try {
    const res = await fetch(`https://rdap.org/domain/${domain}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.status === 404) return 'available';
    if (res.ok) return 'taken';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}
