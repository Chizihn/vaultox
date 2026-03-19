import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as nacl from "tweetnacl";
import * as bs58 from "bs58";
import { PublicKey } from "@solana/web3.js";
import { ComplianceService } from "../compliance/compliance.service";
import { EntraAdapterService } from "../identity/entra-adapter.service";

@Injectable()
export class AuthService {
  // In a production app, store nonces in Redis with a TTL.
  // For this hackathon, we use an in-memory map.
  private nonces = new Map<string, { nonce: string; expiresAt: Date }>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly complianceService: ComplianceService,
    private readonly entraAdapterService: EntraAdapterService,
  ) {}

  generateChallenge(walletAddress: string) {
    const timestamp = Date.now();
    const randomBits = Math.random().toString(36).substring(2, 10);
    const nonce = `VaultOX-auth-${timestamp}-${randomBits}`;

    // Valid for 5 minutes
    const expiresAt = new Date(timestamp + 5 * 60 * 1000);

    this.nonces.set(walletAddress, { nonce, expiresAt });

    return { nonce, expiresAt };
  }

  async verifySignature(
    walletAddress: string,
    signature: string,
    nonce: string,
  ) {
    const record = this.nonces.get(walletAddress);

    if (!record || record.nonce !== nonce) {
      throw new UnauthorizedException("Invalid or expired nonce");
    }

    if (new Date() > record.expiresAt) {
      this.nonces.delete(walletAddress);
      throw new UnauthorizedException("Nonce expired");
    }

    try {
      const publicKey = new PublicKey(walletAddress);
      const signatureBytes = bs58.decode(signature);
      const messageBytes = new TextEncoder().encode(nonce);

      const isValid = nacl.sign.detached.verify(
        messageBytes,
        signatureBytes,
        publicKey.toBytes(),
      );

      if (!isValid) {
        throw new UnauthorizedException("Invalid signature");
      }

      // Clear nonce after successful use
      this.nonces.delete(walletAddress);

      const { credentialStatus, institution } =
        await this.complianceService.resolveCredentialStatus(walletAddress);
      const payload = {
        sub: walletAddress,
        credentialStatus,
        tier: institution?.tier ?? null,
      };
      const accessToken = this.jwtService.sign(payload);

      await this.complianceService.recordAuditEvent(
        walletAddress,
        "auth.login",
        "Wallet authenticated successfully",
        { credentialStatus },
      );

      return {
        accessToken,
        credentialStatus,
        institution,
      };
    } catch (e) {
      throw new UnauthorizedException("Signature verification failed");
    }
  }

  async requestAccess(body: any) {
    return this.complianceService.submitKycRequest(body.walletAddress, body);
  }

  async getRequestAccessStatus(walletAddress: string) {
    const latestRequest =
      await this.complianceService.getLatestKycRequest(walletAddress);

    if (!latestRequest) {
      return { exists: false };
    }

    return {
      exists: true,
      request: latestRequest,
    };
  }

  async approveAccess(walletAddress: string, body?: any) {
    return this.complianceService.approveKycRequest(walletAddress, {
      reviewerNotes: body?.reviewerNotes,
      tier: body?.tier,
      kycLevel: body?.kycLevel,
      amlCoverage: body?.amlCoverage,
      validityDays: body?.validityDays,
      attestationHash: body?.attestationHash,
    });
  }

  verifyEntraAdapter(token: string, requestedWalletAddress?: string) {
    return this.entraAdapterService.validateToken({
      token,
      requestedWalletAddress,
    });
  }

  revokeEntraBinding(input: {
    subjectId: string;
    walletAddress: string;
    reason?: string;
  }) {
    return this.entraAdapterService.revokeBinding(input);
  }

  getEntraBindingStatus(subjectId: string, walletAddress: string) {
    return this.entraAdapterService.getBindingStatus(subjectId, walletAddress);
  }
}
