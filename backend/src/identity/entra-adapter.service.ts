import { Injectable, UnauthorizedException } from "@nestjs/common";
import { createPublicKey, verify as verifySignature } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";

type JwtHeader = {
  alg?: string;
  kid?: string;
  typ?: string;
  [key: string]: unknown;
};

type EntraTokenPayload = {
  sub?: string;
  oid?: string;
  tid?: string;
  aud?: string;
  iss?: string;
  exp?: number;
  iat?: number;
  nbf?: number;
  [key: string]: unknown;
};

type Jwk = {
  kty: string;
  use?: string;
  alg?: string;
  kid?: string;
  n?: string;
  e?: string;
  [key: string]: unknown;
};

type JwksResponse = {
  keys?: Jwk[];
};

type BindingSnapshot = {
  subjectToWallet: Map<string, string>;
  walletToSubject: Map<string, string>;
  revokedPairs: Set<string>;
};

@Injectable()
export class EntraAdapterService {
  private jwksCache: { keys: Jwk[]; fetchedAt: number; url: string } | null =
    null;

  constructor(private readonly prisma: PrismaService) {}

  async validateToken(input: {
    token: string;
    requestedWalletAddress?: string;
  }) {
    const token = input.token.trim();
    if (!token) {
      throw new UnauthorizedException("Missing Entra token");
    }

    const { header, payload, signingInput, signature } = this.decodeJwt(token);
    this.assertSupportedHeader(header);

    const signatureValid = await this.verifyJwtSignature({
      header,
      signingInput,
      signature,
    });

    const nowSeconds = Math.floor(Date.now() / 1000);
    const notBeforeSatisfied =
      typeof payload.nbf === "number" ? payload.nbf <= nowSeconds : true;

    const checks = {
      signatureValid,
      notExpired:
        typeof payload.exp === "number" ? payload.exp > nowSeconds : false,
      notBeforeSatisfied,
      issuerMatches: this.matchExpectedIssuer(payload.iss),
      audienceMatches: this.matchExpectedAudience(payload.aud),
      tenantMatches: this.matchExpectedTenant(payload.tid),
    };

    const walletClaimName = (
      process.env.ENTRA_WALLET_CLAIM || "walletAddress"
    ).trim();
    const claimedWallet = this.extractWalletClaim(payload, walletClaimName);
    const requestedWallet = input.requestedWalletAddress?.trim() || null;
    const walletMatchesRequest = requestedWallet
      ? claimedWallet?.toLowerCase() === requestedWallet.toLowerCase()
      : null;

    const requireWalletClaimMatch =
      (process.env.ENTRA_REQUIRE_WALLET_CLAIM_MATCH ?? "true") === "true";
    if (
      requireWalletClaimMatch &&
      requestedWallet &&
      claimedWallet &&
      claimedWallet.toLowerCase() !== requestedWallet.toLowerCase()
    ) {
      await this.recordIdentityEvent(
        requestedWallet,
        "identity.binding_mismatch",
        "Requested wallet does not match Entra wallet claim",
        {
          requestedWallet,
          claimedWallet,
          subjectId: this.firstString(payload.sub, payload.oid),
        },
      );
      throw new UnauthorizedException(
        "Requested wallet does not match Entra wallet claim",
      );
    }

    const effectiveWalletAddress = requestedWallet ?? claimedWallet;
    const subjectId = this.firstString(payload.sub, payload.oid) ?? null;

    let bindingPolicy:
      | {
          enforced: false;
          reason: string;
          status: "skipped";
        }
      | {
          enforced: true;
          status: "bound";
          action: "existing_binding" | "bound_now";
          subjectId: string;
          walletAddress: string;
        };

    if (subjectId && effectiveWalletAddress) {
      bindingPolicy = await this.enforceBindingPolicy(
        subjectId,
        effectiveWalletAddress,
      );
    } else {
      bindingPolicy = {
        enforced: false,
        reason: "missing_subject_or_wallet",
        status: "skipped",
      };
    }

    return {
      adapter: "entra-oidc-jwks",
      cryptographicVerification: "performed",
      verified:
        checks.signatureValid &&
        checks.notExpired &&
        checks.notBeforeSatisfied &&
        checks.issuerMatches &&
        checks.audienceMatches &&
        checks.tenantMatches,
      checks,
      tokenHeader: {
        alg: this.firstString(header.alg),
        kid: this.firstString(header.kid),
        typ: this.firstString(header.typ),
      },
      subjectId: this.firstString(payload.sub, payload.oid) ?? null,
      tenantId: this.firstString(payload.tid) ?? null,
      audience: this.firstString(payload.aud) ?? null,
      issuer: this.firstString(payload.iss) ?? null,
      walletBinding: {
        claimName: walletClaimName,
        claimedWallet,
        requestedWallet,
        effectiveWalletAddress,
        matchesRequestedWallet: walletMatchesRequest,
      },
      bindingPolicy,
      notes: [
        "JWT signature was validated against Entra JWKS keyset (RS256).",
        "Strict subject-to-wallet binding policy should still be enforced at application level.",
      ],
    };
  }

  async revokeBinding(input: {
    subjectId: string;
    walletAddress: string;
    reason?: string;
  }) {
    const subjectId = input.subjectId.trim();
    const walletAddress = input.walletAddress.trim();
    if (!subjectId || !walletAddress) {
      throw new UnauthorizedException("Missing subjectId or walletAddress");
    }

    await this.recordIdentityEvent(
      walletAddress,
      "identity.binding_revoked",
      "Subject-wallet binding revoked",
      {
        subjectId,
        walletAddress,
        reason: input.reason ?? "manual_revocation",
      },
    );

    return {
      success: true,
      subjectId,
      walletAddress,
      revokedAt: new Date().toISOString(),
    };
  }

  async getBindingStatus(subjectId: string, walletAddress: string) {
    const normalizedSubject = subjectId.trim();
    const normalizedWallet = walletAddress.trim();
    const snapshot = await this.loadBindingSnapshot();
    const pairKey = this.getPairKey(normalizedSubject, normalizedWallet);

    return {
      subjectId: normalizedSubject,
      walletAddress: normalizedWallet,
      active:
        snapshot.subjectToWallet.get(normalizedSubject) === normalizedWallet &&
        snapshot.walletToSubject.get(normalizedWallet) === normalizedSubject,
      revoked: snapshot.revokedPairs.has(pairKey),
      subjectBoundWallet:
        snapshot.subjectToWallet.get(normalizedSubject) ?? null,
      walletBoundSubject:
        snapshot.walletToSubject.get(normalizedWallet) ?? null,
    };
  }

  private decodeJwt(token: string): {
    header: JwtHeader;
    payload: EntraTokenPayload;
    signingInput: Buffer;
    signature: Buffer;
  } {
    const segments = token.split(".");
    if (segments.length !== 3) {
      throw new UnauthorizedException("Invalid JWT format");
    }

    try {
      const [headerSegment, payloadSegment, signatureSegment] = segments;
      const headerJson = Buffer.from(headerSegment, "base64url").toString(
        "utf8",
      );
      const payloadJson = Buffer.from(payloadSegment, "base64url").toString(
        "utf8",
      );

      return {
        header: JSON.parse(headerJson) as JwtHeader,
        payload: JSON.parse(payloadJson) as EntraTokenPayload,
        signingInput: Buffer.from(`${headerSegment}.${payloadSegment}`, "utf8"),
        signature: Buffer.from(signatureSegment, "base64url"),
      };
    } catch {
      throw new UnauthorizedException("Unable to decode JWT");
    }
  }

  private assertSupportedHeader(header: JwtHeader) {
    const alg = this.firstString(header.alg);
    const kid = this.firstString(header.kid);

    if (!alg || alg !== "RS256") {
      throw new UnauthorizedException("Unsupported token algorithm");
    }

    if (!kid) {
      throw new UnauthorizedException("Missing token key identifier (kid)");
    }
  }

  private async verifyJwtSignature(input: {
    header: JwtHeader;
    signingInput: Buffer;
    signature: Buffer;
  }): Promise<boolean> {
    const kid = this.firstString(input.header.kid);
    if (!kid) {
      throw new UnauthorizedException("Missing token key identifier (kid)");
    }

    const jwks = await this.getJwks();
    const key = jwks.find((entry) => entry.kid === kid);
    if (!key) {
      throw new UnauthorizedException("No matching JWKS key for token kid");
    }

    if (key.kty !== "RSA" || !key.n || !key.e) {
      throw new UnauthorizedException("Unsupported JWKS key format");
    }

    try {
      const publicKey = createPublicKey({
        key,
        format: "jwk",
      });

      const verified = verifySignature(
        "RSA-SHA256",
        input.signingInput,
        publicKey,
        input.signature,
      );

      if (!verified) {
        throw new UnauthorizedException("Invalid token signature");
      }

      return true;
    } catch {
      throw new UnauthorizedException("Failed to verify token signature");
    }
  }

  private async getJwks(): Promise<Jwk[]> {
    const jwksUrl = await this.resolveJwksUrl();
    const ttlSeconds = Math.max(
      30,
      Number(process.env.ENTRA_JWKS_CACHE_TTL_SEC ?? "300"),
    );

    if (
      this.jwksCache &&
      this.jwksCache.url === jwksUrl &&
      Date.now() - this.jwksCache.fetchedAt < ttlSeconds * 1000
    ) {
      return this.jwksCache.keys;
    }

    const response = await fetch(jwksUrl);
    if (!response.ok) {
      throw new UnauthorizedException("Unable to fetch Entra JWKS");
    }

    const payload = (await response.json()) as JwksResponse;
    const keys = Array.isArray(payload.keys) ? payload.keys : [];
    if (!keys.length) {
      throw new UnauthorizedException("Entra JWKS contains no keys");
    }

    this.jwksCache = {
      keys,
      fetchedAt: Date.now(),
      url: jwksUrl,
    };

    return keys;
  }

  private async resolveJwksUrl(): Promise<string> {
    const explicit = (process.env.ENTRA_JWKS_URL ?? "").trim();
    if (explicit) {
      return explicit;
    }

    const openIdConfigUrl = (process.env.ENTRA_OPENID_CONFIG_URL ?? "").trim();
    if (openIdConfigUrl) {
      const response = await fetch(openIdConfigUrl);
      if (!response.ok) {
        throw new UnauthorizedException("Unable to fetch Entra OpenID config");
      }

      const config = (await response.json()) as { jwks_uri?: string };
      if (typeof config.jwks_uri === "string" && config.jwks_uri.trim()) {
        return config.jwks_uri.trim();
      }
    }

    const tenantId = (process.env.ENTRA_TENANT_ID ?? "").trim();
    if (tenantId) {
      return `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`;
    }

    const issuer = (process.env.ENTRA_ISSUER ?? "").trim();
    if (issuer) {
      const normalizedIssuer = issuer.replace(/\/+$/, "");
      if (normalizedIssuer.endsWith("/v2.0")) {
        const base = normalizedIssuer.slice(0, -"/v2.0".length);
        return `${base}/discovery/v2.0/keys`;
      }
    }

    throw new UnauthorizedException(
      "Entra JWKS resolution not configured. Set ENTRA_JWKS_URL, ENTRA_OPENID_CONFIG_URL, or ENTRA_TENANT_ID.",
    );
  }

  private matchExpectedIssuer(actual?: string): boolean {
    const expected = (process.env.ENTRA_ISSUER ?? "").trim();
    if (!expected) {
      return true;
    }
    return (actual ?? "").trim() === expected;
  }

  private matchExpectedAudience(actual?: string): boolean {
    const expected = (process.env.ENTRA_AUDIENCE ?? "").trim();
    if (!expected) {
      return true;
    }
    return (actual ?? "").trim() === expected;
  }

  private matchExpectedTenant(actual?: string): boolean {
    const expected = (process.env.ENTRA_TENANT_ID ?? "").trim();
    if (!expected) {
      return true;
    }
    return (actual ?? "").trim() === expected;
  }

  private extractWalletClaim(
    payload: EntraTokenPayload,
    walletClaimName: string,
  ): string | null {
    const directValue = payload[walletClaimName];
    if (typeof directValue === "string" && directValue.trim()) {
      return directValue.trim();
    }

    const extensionValue = payload[`extension_${walletClaimName}`];
    if (typeof extensionValue === "string" && extensionValue.trim()) {
      return extensionValue.trim();
    }

    return null;
  }

  private firstString(...values: Array<unknown>): string | null {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
    return null;
  }

  private async enforceBindingPolicy(subjectId: string, walletAddress: string) {
    const snapshot = await this.loadBindingSnapshot();
    const pairKey = this.getPairKey(subjectId, walletAddress);
    const allowRebindAfterRevocation =
      (process.env.ENTRA_ALLOW_REBIND_AFTER_REVOCATION ?? "false") === "true";

    if (snapshot.revokedPairs.has(pairKey) && !allowRebindAfterRevocation) {
      await this.recordIdentityEvent(
        walletAddress,
        "identity.binding_mismatch",
        "Authentication blocked: binding was revoked",
        { subjectId, walletAddress, reason: "binding_revoked" },
      );
      throw new UnauthorizedException(
        "Subject-wallet binding has been revoked",
      );
    }

    const existingWallet = snapshot.subjectToWallet.get(subjectId);
    if (existingWallet && existingWallet !== walletAddress) {
      await this.recordIdentityEvent(
        walletAddress,
        "identity.binding_mismatch",
        "Authentication blocked: subject bound to different wallet",
        {
          subjectId,
          walletAddress,
          boundWallet: existingWallet,
          reason: "subject_bound_to_other_wallet",
        },
      );
      throw new UnauthorizedException(
        "Subject is already bound to a different wallet",
      );
    }

    const existingSubject = snapshot.walletToSubject.get(walletAddress);
    if (existingSubject && existingSubject !== subjectId) {
      await this.recordIdentityEvent(
        walletAddress,
        "identity.binding_mismatch",
        "Authentication blocked: wallet bound to different subject",
        {
          subjectId,
          walletAddress,
          boundSubject: existingSubject,
          reason: "wallet_bound_to_other_subject",
        },
      );
      throw new UnauthorizedException(
        "Wallet is already bound to a different subject",
      );
    }

    if (existingWallet === walletAddress && existingSubject === subjectId) {
      return {
        enforced: true as const,
        status: "bound" as const,
        action: "existing_binding" as const,
        subjectId,
        walletAddress,
      };
    }

    const autoBind =
      (process.env.ENTRA_AUTO_BIND_ON_VERIFY ?? "true") === "true";
    if (!autoBind) {
      await this.recordIdentityEvent(
        walletAddress,
        "identity.binding_mismatch",
        "Authentication blocked: no existing binding and auto-bind disabled",
        {
          subjectId,
          walletAddress,
          reason: "binding_missing_auto_bind_disabled",
        },
      );
      throw new UnauthorizedException(
        "No subject-wallet binding found and auto-bind is disabled",
      );
    }

    await this.recordIdentityEvent(
      walletAddress,
      "identity.binding_created",
      "Subject-wallet binding created",
      {
        subjectId,
        walletAddress,
      },
    );

    return {
      enforced: true as const,
      status: "bound" as const,
      action: "bound_now" as const,
      subjectId,
      walletAddress,
    };
  }

  private async loadBindingSnapshot(): Promise<BindingSnapshot> {
    const events = await this.prisma.auditEvent.findMany({
      where: {
        eventType: {
          in: [
            "identity.binding_created",
            "identity.binding_revoked",
            "identity.binding_mismatch",
          ],
        },
      },
      orderBy: { createdAt: "asc" },
      take: 5000,
    });

    const subjectToWallet = new Map<string, string>();
    const walletToSubject = new Map<string, string>();
    const revokedPairs = new Set<string>();

    for (const event of events) {
      const metadata =
        event.metadata && typeof event.metadata === "object"
          ? (event.metadata as Record<string, unknown>)
          : {};

      const subjectId = this.firstString(metadata.subjectId);
      const walletAddress = this.firstString(metadata.walletAddress);
      if (!subjectId || !walletAddress) {
        continue;
      }

      const pairKey = this.getPairKey(subjectId, walletAddress);

      if (event.eventType === "identity.binding_created") {
        subjectToWallet.set(subjectId, walletAddress);
        walletToSubject.set(walletAddress, subjectId);
        revokedPairs.delete(pairKey);
        continue;
      }

      if (event.eventType === "identity.binding_revoked") {
        if (subjectToWallet.get(subjectId) === walletAddress) {
          subjectToWallet.delete(subjectId);
        }
        if (walletToSubject.get(walletAddress) === subjectId) {
          walletToSubject.delete(walletAddress);
        }
        revokedPairs.add(pairKey);
      }
    }

    return { subjectToWallet, walletToSubject, revokedPairs };
  }

  private getPairKey(subjectId: string, walletAddress: string) {
    return `${subjectId}::${walletAddress.toLowerCase()}`;
  }

  private async recordIdentityEvent(
    walletAddress: string,
    eventType:
      | "identity.binding_created"
      | "identity.binding_revoked"
      | "identity.binding_mismatch",
    description: string,
    metadata: Record<string, unknown>,
  ) {
    await this.prisma.auditEvent.create({
      data: {
        walletAddress,
        eventType,
        description,
        metadata: metadata as any,
      },
    });
  }
}
