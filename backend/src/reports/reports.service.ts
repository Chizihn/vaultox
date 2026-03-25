import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { GenerateReportDto } from "./dto/generate-report.dto";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const CLOUDINARY_READY =
  !!process.env.CLOUDINARY_CLOUD_NAME &&
  !!process.env.CLOUDINARY_API_KEY &&
  !!process.env.CLOUDINARY_API_SECRET;

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── List ────────────────────────────────────────────────────────────────

  async getReports(walletAddress: string) {
    const rows = await this.prisma.report.findMany({
      where: { walletAddress },
      orderBy: { createdAt: "desc" }, // Report model still has createdAt
    });
    return rows.map((r) => this.toDto(r));
  }

  // ─── Generate ────────────────────────────────────────────────────────────

  async generateReport(walletAddress: string, dto: GenerateReportDto) {
    const from = new Date(dto.period.from);
    const to = new Date(dto.period.to);
    // Set end of day so period is inclusive
    to.setHours(23, 59, 59, 999);

    const includeSettlements = dto.includeSettlements !== false;
    const includeAuditLog = dto.includeAuditLog !== false;

    // ── Compile report data from live DB ─────────────────────────────────
    const [settlements, auditEvents, amlScreenings, kycRequest] =
      await Promise.all([
        includeSettlements
          ? this.prisma.settlement.findMany({
              where: {
                OR: [
                  { initiatorWallet: walletAddress },
                  { receiverWallet: walletAddress },
                ],
                createdAt: { gte: from, lte: to },
              },
              orderBy: { createdAt: "desc" },
            })
          : Promise.resolve([]),

        includeAuditLog
          ? this.prisma.auditEvent.findMany({
              where: {
                walletAddress,
                createdAt: { gte: from, lte: to },
              },
              orderBy: { createdAt: "desc" },
            })
          : Promise.resolve([]),

        this.prisma.amlScreening.findMany({
          where: {
            walletAddress,
            screenedAt: { gte: from, lte: to },
          },
          orderBy: { screenedAt: "desc" },
        }),

        this.prisma.kycRequest.findFirst({
          where: { walletAddress },
          orderBy: { upgradeCreatedAt: "desc" },
        }),
      ]);

    // ── Build PDF Document ─────────────────────────────────────────────
    const PDFDocument = require("pdfkit");
    const fs = require("fs");
    const path = require("path");
    const doc = new PDFDocument({ margin: 0 });
    const buffers: Buffer[] = [];

    doc.on("data", buffers.push.bind(buffers));

    const buildPdf = new Promise<Buffer>((resolve) => {
      doc.on("end", () => {
        resolve(Buffer.concat(buffers));
      });
    });

    // Handle branding colors
    const colors = {
      primary: "#C8A05B", // Gold
      text: "#222222",
      muted: "#888888",
      bg: "#0D0D0D",
      ok: "#00E076",
      warn: "#FF3366",
      white: "#FFFFFF",
    };

    // Draw header background
    doc.rect(0, 0, doc.page.width, 90).fill(colors.bg);

    // Insert logo from URL (centered vertically in header)
    const https = require("https");
    const os = require("os");
    const logoUrl = "https://vaultox.vercel.app/vaultox-logo.png";
    const logoTmpPath = path.join(
      os.tmpdir(),
      `vaultox-logo-${Date.now()}.png`,
    );

  // Helper to download image synchronously before PDF generation
  function downloadImage(url, dest) {
    return new Promise<void>((resolve, reject) => {
      const file = fs.createWriteStream(dest);
      https
        .get(url, (response) => {
          response.pipe(file);
          file.on("finish", () => {
            file.close(resolve);
          });
        })
        .on("error", (err) => {
          fs.unlink(dest, () => {});
          resolve(); // Don't block PDF if logo fails
        });
    });
  }

    await downloadImage(logoUrl, logoTmpPath);
    if (fs.existsSync(logoTmpPath)) {
      doc.image(logoTmpPath, 40, 20, { width: 90, height: 50 });
    }

    // Header text (next to logo)
    doc
      .fillColor(colors.primary)
      .fontSize(28)
      .text("VaultOS", 140, 28, { align: "left", continued: false });
    doc
      .fontSize(12)
      .fillColor(colors.white)
      .text("Institutional Stablecoin Treasury", 140, 60, { align: "left" });

    // Move below header
    doc.moveDown().moveDown();
    doc.y = 110;

    // Title
    doc
      .fontSize(18)
      .fillColor(colors.text)
      .text(`${dto.framework} Compliance Report`, { align: "center" })
      .fontSize(10)
      .fillColor(colors.muted)
      .text(
        `${from.toISOString().split("T")[0]} to ${to.toISOString().split("T")[0]}`,
        { align: "center" },
      )
      .moveDown(3);

    // Institution Profile
    doc
      .fontSize(14)
      .fillColor(colors.primary)
      .text("Institution Profile")
      .moveDown(0.5);
    doc
      .fontSize(10)
      .fillColor(colors.text)
      .text(`Institution: ${kycRequest?.institutionName ?? "Unknown"}`)
      .text(`Wallet Address: ${walletAddress}`)
      .text(`Jurisdiction: ${kycRequest?.jurisdiction ?? "Unknown"}`)
      .text(`Tier: ${kycRequest?.tier ?? "Unregistered"}`)
      .moveDown(2);

    // Compliance Summary
    doc
      .fontSize(14)
      .fillColor(colors.primary)
      .text("Compliance Summary")
      .moveDown(0.5);
    doc
      .fontSize(10)
      .fillColor(colors.text)
      .text(`Total AML Screenings: ${amlScreenings.length}`)
      .text(
        `AML Flags Raised: ${amlScreenings.filter((s) => s.status === "flagged").length}`,
      )
      .text(
        `Travel Rule Compliant Settlements: ${settlements.filter((s) => s.travelRulePayload !== null).length}`,
      )
      .text(`Total Audit Events log: ${auditEvents.length}`)
      .moveDown(2);

    // Settlement Summary
    if (includeSettlements && settlements.length > 0) {
      doc.addPage();
      doc
        .fontSize(14)
        .fillColor(colors.primary)
        .text("Settlement Activity")
        .moveDown(0.5);

      const successRate = (
        (settlements.filter((s) => s.status === "completed").length /
          settlements.length) *
        100
      ).toFixed(2);

      doc
        .fontSize(10)
        .fillColor(colors.text)
        .text(`Total Settlements: ${settlements.length}`)
        .text(
          `Completed: ${settlements.filter((s) => s.status === "completed").length} (${successRate}%)`,
        )
        .text(
          `Pending: ${settlements.filter((s) => s.status === "pending").length}`,
        )
        .text(
          `Failed: ${settlements.filter((s) => s.status === "failed").length}`,
        )
        .text(
          `Total Volume (USDC): $${settlements
            .filter((s) => s.status === "completed")
            .reduce((acc, s) => acc + s.amount, 0)
            .toLocaleString()}`,
        )
        .moveDown(1.5);

      // Table Header
      doc
        .fontSize(10)
        .fillColor(colors.muted)
        .text("Date", 50, doc.y, { width: 100, continued: true })
        .text("From", 150, doc.y, { width: 100, continued: true })
        .text("To", 250, doc.y, { width: 100, continued: true })
        .text("Amount (USDC)", 350, doc.y, { width: 100, continued: true })
        .text("Status", 450, doc.y);

      doc
        .moveTo(50, doc.y + 5)
        .lineTo(550, doc.y + 5)
        .strokeColor(colors.muted)
        .stroke()
        .moveDown(1);

      // Table Rows
      doc.fillColor(colors.text);
      let count = 0;
      for (const s of settlements) {
        if (count >= 15) {
          // Pagination protection for large lists
          doc.text("... and more records truncated for brevity.", 50, doc.y);
          break;
        }
        const date = s.createdAt.toISOString().split("T")[0];
        doc
          .text(date, 50, doc.y, { width: 100, continued: true })
          .text(
            (s.fromInstitutionName || "Unknown").substring(0, 15),
            150,
            doc.y,
            { width: 100, continued: true },
          )
          .text(
            (s.toInstitutionName || "Unknown").substring(0, 15),
            250,
            doc.y,
            { width: 100, continued: true },
          )
          .text(Number(s.amount).toLocaleString(), 350, doc.y, {
            width: 100,
            continued: true,
          })
          .fillColor(
            s.status === "completed"
              ? colors.ok
              : s.status === "failed"
                ? colors.warn
                : colors.text,
          )
          .text(s.status, 450, doc.y);
        doc.fillColor(colors.text); // reset
        doc.moveDown(0.5);
        count++;
      }
      doc.moveDown(2);
    }

    // Audit Log
    if (includeAuditLog && auditEvents.length > 0) {
      doc.addPage();
      doc
        .fontSize(14)
        .fillColor(colors.primary)
        .text("Audit Trail")
        .moveDown(0.5);

      let count = 0;
      for (const e of auditEvents) {
        if (count >= 20) {
          doc
            .fontSize(10)
            .fillColor(colors.muted)
            .text("... additional audit events truncated.");
          break;
        }
        doc
          .fontSize(8)
          .fillColor(colors.muted)
          .text(e.createdAt.toISOString().replace("T", " ").substring(0, 19));
        doc
          .fontSize(10)
          .fillColor(colors.text)
          .text(`[${e.eventType}] ${e.description}`);
        if (e.txHash) {
          doc.fontSize(8).fillColor(colors.muted).text(`Tx: ${e.txHash}`);
        }
        doc.moveDown(0.5);
        count++;
      }
    }

    doc.end();

    const fileBuffer = await buildPdf;
    const fileName = `${dto.framework}_${dto.period.from}_${dto.period.to}_${Date.now()}.pdf`;

    // ── Upload to Cloudinary (or store inline if not configured) ─────────
    let downloadUrl: string | null = null;
    let fileSizeBytes = fileBuffer.length;

    if (CLOUDINARY_READY) {
      try {
        const uploadResult = await this.uploadToCloudinary(
          fileBuffer,
          fileName,
        );
        downloadUrl = uploadResult.secure_url;
        fileSizeBytes = uploadResult.bytes;
      } catch (err) {
        console.error(
          "[Reports] Cloudinary upload failed — storing inline",
          err,
        );
        // Fallback: store as data URL so download still works
        downloadUrl = `data:application/pdf;base64,${fileBuffer.toString("base64")}`;
      }
    } else {
      // No Cloudinary configured — encode as data URL for direct browser download
      downloadUrl = `data:application/pdf;base64,${fileBuffer.toString("base64")}`;
    }

    // ── Persist report record ─────────────────────────────────────────────
    const row = await this.prisma.report.create({
      data: {
        walletAddress,
        framework: dto.framework,
        title: `${dto.framework} Compliance Report`,
        fileName,
        status: "ready",
        downloadUrl,
        fileSizeBytes,
        periodFrom: from,
        periodTo: to,
        completedAt: new Date(),
      },
    });

    return this.toDto(row);
  }

  // ─── Compliance summary ───────────────────────────────────────────────────

  async getComplianceSummary(walletAddress: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [active, pending, restricted, amlAll, flags, travelRule, events] =
      await Promise.all([
        this.prisma.kycRequest.count({
          where: { walletAddress, status: "approved" },
        }),
        this.prisma.kycRequest.count({
          where: { walletAddress, status: "pending" },
        }),
        this.prisma.kycRequest.count({
          where: { walletAddress, status: "rejected" },
        }),
        this.prisma.amlScreening.count({
          where: { walletAddress, screenedAt: { gte: startOfMonth } },
        }),
        this.prisma.amlScreening.count({
          where: {
            walletAddress,
            status: "flagged",
            screenedAt: { gte: startOfMonth },
          },
        }),
        this.prisma.settlement.count({
          where: {
            OR: [
              { initiatorWallet: walletAddress },
              { receiverWallet: walletAddress },
            ],
            NOT: { travelRulePayload: null },
          },
        }),
        this.prisma.auditEvent.count({
          where: { walletAddress, createdAt: { gte: startOfMonth } },
        }),
      ]);

    return {
      activeCredentials: active,
      pendingCredentials: pending,
      restrictedCredentials: restricted,
      amlScreeningsThisMonth: amlAll,
      amlFlagsRaised: flags,
      travelRuleCompliantTransactions: travelRule,
      auditEventsThisMonth: events,
    };
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private toDto(r: {
    id: string;
    framework: string;
    title: string;
    fileName: string;
    status: string;
    downloadUrl: string | null;
    fileSizeBytes: number | null;
    periodFrom: Date;
    periodTo: Date;
    createdAt: Date;
    completedAt: Date | null;
  }) {
    return {
      id: r.id,
      framework: r.framework,
      title: r.title,
      fileName: r.fileName,
      status: r.status as "ready" | "generating" | "failed",
      downloadUrl: r.downloadUrl ?? undefined,
      fileSizeBytes: r.fileSizeBytes ?? undefined,
      dateRange: {
        start: r.periodFrom.toISOString(),
        end: r.periodTo.toISOString(),
      },
      generatedAt: (r.completedAt ?? r.createdAt).toISOString(),
    };
  }

  private uploadToCloudinary(
    buffer: Buffer,
    publicId: string,
  ): Promise<{ secure_url: string; bytes: number }> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: "raw",
          folder: "vaultox/reports",
          public_id: publicId,
          overwrite: true,
        },
        (error, result) => {
          if (error) return reject(error);
          resolve({ secure_url: result!.secure_url, bytes: result!.bytes });
        },
      );
      stream.end(buffer);
    });
  }
}
