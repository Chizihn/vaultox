import { Injectable, Logger } from "@nestjs/common";
import { createTransport, Transporter } from "nodemailer";

type EmailTemplate =
  | "kyc-approved"
  | "kyc-rejected"
  | "settlement-initiated"
  | "settlement-completed"
  | "settlement-failed";

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
  text: string;
}

interface EmailContext {
  template: EmailTemplate;
  to: string;
  data: Record<string, any>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter | null = null;

  constructor() {
    this.initializeTransport();
  }

  private initializeTransport() {
    const smtpHost = process.env.SMTP_HOST?.trim();
    const smtpPort = process.env.SMTP_PORT?.trim();
    const smtpUser = process.env.SMTP_USER?.trim();
    const smtpPassword =
      process.env.SMTP_PASSWORD?.trim() || process.env.SMTP_PASS?.trim();

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword) {
      this.logger.warn(
        "SMTP_HOST, SMTP_PORT, SMTP_USER, or SMTP_PASSWORD/SMTP_PASS not set — email service disabled",
      );
      return;
    }

    try {
      this.transporter = createTransport({
        host: smtpHost,
        port: parseInt(smtpPort, 10),
        auth: {
          user: smtpUser,
          pass: smtpPassword,
        },
      });

      this.logger.log(`Email service initialized for ${smtpHost}:${smtpPort}`);
    } catch (error) {
      this.logger.error(`Failed to initialize email service: ${error}`);
    }
  }

  async send(context: EmailContext): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn("Email service not configured — skipping send");
      return false;
    }

    const payload = this.renderTemplate(context);

    try {
      await this.transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: context.to,
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      });

      this.logger.log(
        `Email sent to ${context.to} (template: ${context.template})`,
      );
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email to ${context.to}: ${error}`);
      return false;
    }
  }

  private renderTemplate(context: EmailContext): EmailPayload {
    switch (context.template) {
      case "kyc-approved":
        return this.renderKycApproved(context.to, context.data);
      case "kyc-rejected":
        return this.renderKycRejected(context.to, context.data);
      case "settlement-initiated":
        return this.renderSettlementInitiated(context.to, context.data);
      case "settlement-completed":
        return this.renderSettlementCompleted(context.to, context.data);
      case "settlement-failed":
        return this.renderSettlementFailed(context.to, context.data);
      default:
        throw new Error(`Unknown email template: ${context.template}`);
    }
  }

  private renderKycApproved(
    to: string,
    data: Record<string, any>,
  ): EmailPayload {
    const institutionName = data.institutionName ?? "Your Institution";
    const tier = data.tier ?? "Unknown";

    return {
      to,
      subject: "KYC Approval — VaultOX Access Granted",
      html: `
<html>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; border-radius: 8px;">
      <h2 style="color: #00c9a7;">KYC Approval Confirmed</h2>
      <p>Dear ${institutionName},</p>
      <p>Your KYC submission has been approved and your institutional access to VaultOX is now <strong>active</strong>.</p>
      <div style="background: white; padding: 15px; border-left: 4px solid #00c9a7; margin: 20px 0;">
        <p><strong>Compliance Tier:</strong> ${tier}</p>
        <p><strong>Access Level:</strong> Full institutional treasury operations</p>
        <p><strong>Approval Date:</strong> ${new Date().toISOString().slice(0, 10)}</p>
      </div>
      <p>You can now:</p>
      <ul>
        <li>Initiate cross-border settlements</li>
        <li>Manage vault strategies and positions</li>
        <li>Access compliance reporting</li>
        <li>Track transaction audit trails</li>
      </ul>
      <p>For support, contact: <strong>support@vaultox.finance</strong></p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="font-size: 12px; color: #888;">This is an automated message from VaultOX. Please do not reply to this email.</p>
    </div>
  </body>
</html>`,
      text: `
KYC Approval Confirmed

Dear ${institutionName},

Your KYC submission has been approved and your institutional access to VaultOX is now active.

Compliance Tier: ${tier}
Access Level: Full institutional treasury operations
Approval Date: ${new Date().toISOString().slice(0, 10)}

You can now:
- Initiate cross-border settlements
- Manage vault strategies and positions
- Access compliance reporting
- Track transaction audit trails

For support, contact: support@vaultox.finance

This is an automated message from VaultOX.`,
    };
  }

  private renderKycRejected(
    to: string,
    data: Record<string, any>,
  ): EmailPayload {
    const institutionName = data.institutionName ?? "Your Institution";
    const reason = data.reason ?? "Does not meet compliance requirements";

    return {
      to,
      subject: "KYC Status Update — Additional Information Needed",
      html: `
<html>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; border-radius: 8px;">
      <h2 style="color: #ff5a5a;">KYC Review Status</h2>
      <p>Dear ${institutionName},</p>
      <p>Your KYC submission requires additional review or documentation.</p>
      <div style="background: white; padding: 15px; border-left: 4px solid #ff5a5a; margin: 20px 0;">
        <p><strong>Status:</strong> Under Review</p>
        <p><strong>Reason:</strong> ${reason}</p>
      </div>
      <p>Next steps:</p>
      <ul>
        <li>Review the feedback provided in your VaultOX dashboard</li>
        <li>Submit additional documentation if requested</li>
        <li>Resubmit your application for expedited review</li>
      </ul>
      <p>For assistance, contact: <strong>compliance@vaultox.finance</strong></p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="font-size: 12px; color: #888;">This is an automated message from VaultOX.</p>
    </div>
  </body>
</html>`,
      text: `
KYC Review Status

Dear ${institutionName},

Your KYC submission requires additional review or documentation.

Status: Under Review
Reason: ${reason}

Next steps:
- Review the feedback provided in your VaultOX dashboard
- Submit additional documentation if requested
- Resubmit your application for expedited review

For assistance, contact: compliance@vaultox.finance

This is an automated message from VaultOX.`,
    };
  }

  private renderSettlementInitiated(
    to: string,
    data: Record<string, any>,
  ): EmailPayload {
    const settlementId = data.settlementId ?? "N/A";
    const amount = data.amount ?? "0";
    const receiver = data.receiver ?? "Unknown";

    return {
      to,
      subject: `Settlement Initiated — ${amount} USDC to ${receiver}`,
      html: `
<html>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; border-radius: 8px;">
      <h2 style="color: #4fc3c3;">Settlement Initiated</h2>
      <p>Your cross-border settlement has been initiated and is pending confirmation.</p>
      <div style="background: white; padding: 15px; border-left: 4px solid #4fc3c3; margin: 20px 0;">
        <p><strong>Settlement ID:</strong> ${settlementId}</p>
        <p><strong>Amount:</strong> ${amount} USDC</p>
        <p><strong>Receiver:</strong> ${receiver}</p>
        <p><strong>Status:</strong> Awaiting on-chain confirmation</p>
        <p><strong>Initiated:</strong> ${new Date().toISOString()}</p>
      </div>
      <p>You can track the status of this settlement in your VaultOX dashboard.</p>
      <p>For questions, contact: <strong>operations@vaultox.finance</strong></p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="font-size: 12px; color: #888;">This is an automated message from VaultOX.</p>
    </div>
  </body>
</html>`,
      text: `
Settlement Initiated

Your cross-border settlement has been initiated and is pending confirmation.

Settlement ID: ${settlementId}
Amount: ${amount} USDC
Receiver: ${receiver}
Status: Awaiting on-chain confirmation
Initiated: ${new Date().toISOString()}

You can track the status of this settlement in your VaultOX dashboard.

For questions, contact: operations@vaultox.finance

This is an automated message from VaultOX.`,
    };
  }

  private renderSettlementCompleted(
    to: string,
    data: Record<string, any>,
  ): EmailPayload {
    const settlementId = data.settlementId ?? "N/A";
    const amount = data.amount ?? "0";
    const txHash = data.txHash ?? "N/A";

    return {
      to,
      subject: `Settlement Completed ✓ — ${amount} USDC sent`,
      html: `
<html>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; border-radius: 8px;">
      <h2 style="color: #22c55e;">Settlement Completed</h2>
      <p>Your cross-border settlement has been completed successfully.</p>
      <div style="background: white; padding: 15px; border-left: 4px solid #22c55e; margin: 20px 0;">
        <p><strong>Settlement ID:</strong> ${settlementId}</p>
        <p><strong>Amount:</strong> ${amount} USDC</p>
        <p><strong>Transaction Hash:</strong> <code>${txHash}</code></p>
        <p><strong>Status:</strong> Confirmed on-chain</p>
        <p><strong>Completed:</strong> ${new Date().toISOString()}</p>
      </div>
      <p>The funds have been transferred. You can verify the transaction on <strong>Solana Explorer</strong>.</p>
      <p>For audit and compliance records, see your VaultOX reports section.</p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="font-size: 12px; color: #888;">This is an automated message from VaultOX.</p>
    </div>
  </body>
</html>`,
      text: `
Settlement Completed ✓

Your cross-border settlement has been completed successfully.

Settlement ID: ${settlementId}
Amount: ${amount} USDC
Transaction Hash: ${txHash}
Status: Confirmed on-chain
Completed: ${new Date().toISOString()}

The funds have been transferred. Verify the transaction on Solana Explorer.

For audit and compliance records, see your VaultOX reports section.

This is an automated message from VaultOX.`,
    };
  }

  private renderSettlementFailed(
    to: string,
    data: Record<string, any>,
  ): EmailPayload {
    const settlementId = data.settlementId ?? "N/A";
    const reason = data.reason ?? "Unknown";

    return {
      to,
      subject: `Settlement Alert — Transaction Failed`,
      html: `
<html>
  <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
    <div style="max-width: 600px; margin: 0 auto; padding: 20px; background: #f9f9f9; border-radius: 8px;">
      <h2 style="color: #ff5a5a;">Settlement Failed</h2>
      <p>Your settlement transaction encountered an error and did not complete.</p>
      <div style="background: white; padding: 15px; border-left: 4px solid #ff5a5a; margin: 20px 0;">
        <p><strong>Settlement ID:</strong> ${settlementId}</p>
        <p><strong>Status:</strong> Failed</p>
        <p><strong>Reason:</strong> ${reason}</p>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
      </div>
      <p>Next steps:</p>
      <ul>
        <li>Review the error details in your VaultOX dashboard</li>
        <li>Contact operations for manual review if needed</li>
        <li>Retry the settlement with updated parameters</li>
      </ul>
      <p>For support, contact: <strong>support@vaultox.finance</strong></p>
      <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
      <p style="font-size: 12px; color: #888;">This is an automated message from VaultOX.</p>
    </div>
  </body>
</html>`,
      text: `
Settlement Failed

Your settlement transaction encountered an error and did not complete.

Settlement ID: ${settlementId}
Status: Failed
Reason: ${reason}
Time: ${new Date().toISOString()}

Next steps:
- Review the error details in your VaultOX dashboard
- Contact operations for manual review if needed
- Retry the settlement with updated parameters

For support, contact: support@vaultox.finance

This is an automated message from VaultOX.`,
    };
  }
}
