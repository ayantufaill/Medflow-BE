import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AuthenticationError } from '../utils/error.util';

// ─── Module-level branch cache ────────────────────────────────────────────────
//
// To avoid a DB round-trip on every request, resolved branch records are cached
// in memory for BRANCH_CACHE_TTL_MS milliseconds. This is safe because branch
// subdomain → schemaName mappings change only during provisioning (a rare event).
// The cache auto-expires entries; a new branch or subdomain change will be
// visible within TTL_MS at most.

const BRANCH_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CachedBranch {
  schemaName: string;
  groupId: number;
  branchId: number;
  cachedAt: number;
}

const branchCache = new Map<string, CachedBranch>();

function getCached(subdomain: string): CachedBranch | null {
  const entry = branchCache.get(subdomain);
  if (!entry) return null;
  if (Date.now() - entry.cachedAt > BRANCH_CACHE_TTL_MS) {
    branchCache.delete(subdomain);
    return null;
  }
  return entry;
}

// ─── Subdomain Extraction ─────────────────────────────────────────────────────

/**
 * Extracts the tenant subdomain from the incoming request.
 *
 * Resolution order:
 *  1. `X-Tenant-Subdomain` header  (set by API gateways / Nginx for internal calls)
 *  2. `req.subdomains[0]`          (Express parsed from Host header; works for *.medflow.com)
 *  3. JWT claim `tenantSubdomain`  (set on the token at login time — fallback for mobile/CLI)
 *
 * Returns null if no tenant identifier can be found.
 */
function extractSubdomain(req: Request): string | null {
  // 1. Explicit header (highest priority — useful for testing and internal services)
  const headerSubdomain = req.headers['x-tenant-subdomain'] as string | undefined;
  if (headerSubdomain?.trim()) {
    return headerSubdomain.trim().toLowerCase();
  }

  // 2. Express subdomain parsing from Host header
  //    Requires app.set('subdomain offset', N) in app.ts if behind a multi-part TLD.
  //    Works automatically for: riverside.medflow.com → subdomains[0] = 'riverside'
  if (req.subdomains && req.subdomains.length > 0) {
    return req.subdomains[0].toLowerCase();
  }

  // 3. JWT claim — available after authenticate() middleware runs
  if ((req as any).user?.tenantSubdomain) {
    return (req as any).user.tenantSubdomain.toLowerCase();
  }

  return null;
}

// ─── Middleware ───────────────────────────────────────────────────────────────

/**
 * Tenant Resolver Middleware
 *
 * Resolves the current request's tenant (branch) from the subdomain, then
 * attaches the resolved tenant context to `req.tenant` for use downstream.
 *
 * NOTE: This middleware does NOT change the Postgres search_path directly —
 * the current architecture uses a single shared schema with ClinicNum scoping.
 * The `schemaName` field is attached to `req.tenant` so it's available when the
 * full per-schema routing is implemented in a future phase.
 *
 * Usage in routes:
 *   router.use(authenticate, resolveTenant, yourController);
 *
 * In controllers:
 *   const { branchId, groupId, schemaName } = req.tenant!;
 */
export const resolveTenant = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const subdomain = extractSubdomain(req);

    if (!subdomain) {
      // No tenant identifier found — reject the request.
      return next(
        new AuthenticationError(
          'Could not determine the tenant for this request. ' +
          'Ensure you are accessing via a branch subdomain or include X-Tenant-Subdomain header.'
        )
      );
    }

    // Check in-memory cache first
    const cached = getCached(subdomain);
    if (cached) {
      req.tenant = {
        subdomain,
        schemaName: cached.schemaName,
        groupId: cached.groupId,
        branchId: cached.branchId,
      };
      return next();
    }

    // Cache miss — look up from the shared `branches` table
    const branch = await prisma.branches.findFirst({
      where: { subdomain, isActive: true },
    });

    if (!branch) {
      return next(
        new AuthenticationError(
          `No active branch found for subdomain "${subdomain}". ` +
          'Please contact your administrator.'
        )
      );
    }

    // Populate cache and attach to request
    const entry: CachedBranch = {
      schemaName: branch.schemaName,
      groupId: branch.groupId,
      branchId: branch.id,
      cachedAt: Date.now(),
    };
    branchCache.set(subdomain, entry);

    req.tenant = {
      subdomain,
      schemaName: branch.schemaName,
      groupId: branch.groupId,
      branchId: branch.id,
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Invalidates a specific subdomain from the branch cache.
 * Call this after provisioning or deactivating a branch to ensure
 * stale entries don't persist until TTL expiry.
 */
export function invalidateBranchCache(subdomain: string): void {
  branchCache.delete(subdomain.toLowerCase());
}

/**
 * Clears the entire branch cache.
 * Useful in tests or after a bulk branch update.
 */
export function clearBranchCache(): void {
  branchCache.clear();
}
