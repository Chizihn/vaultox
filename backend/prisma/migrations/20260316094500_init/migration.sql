-- CreateEnum
CREATE TYPE "KycRequestStatus" AS ENUM ('pending', 'approved', 'rejected', 'under_review');

-- CreateEnum
CREATE TYPE "AmlScreeningStatus" AS ENUM ('cleared', 'flagged', 'review');

-- CreateEnum
CREATE TYPE "PersistedSettlementStatus" AS ENUM ('pending', 'settling', 'completed', 'cancelled', 'failed');

-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "tx_hash" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kyc_requests" (
    "id" TEXT NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "institution_name" TEXT NOT NULL,
    "jurisdiction" TEXT,
    "role" TEXT,
    "email" TEXT,
    "tier" INTEGER NOT NULL DEFAULT 3,
    "kyc_documents_hash" TEXT,
    "status" "KycRequestStatus" NOT NULL DEFAULT 'pending',
    "reviewer_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kyc_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "aml_screenings" (
    "id" TEXT NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "risk_score" INTEGER NOT NULL,
    "status" "AmlScreeningStatus" NOT NULL DEFAULT 'cleared',
    "flags" JSONB NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'MockAmlProvider',
    "provider_ref" TEXT,
    "screened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "aml_screenings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlements" (
    "id" TEXT NOT NULL,
    "initiator_wallet" TEXT NOT NULL,
    "receiver_wallet" TEXT NOT NULL,
    "from_institution_name" TEXT NOT NULL,
    "to_institution_name" TEXT NOT NULL,
    "from_jurisdiction" TEXT,
    "to_jurisdiction" TEXT,
    "amount" DECIMAL(20,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USDC',
    "status" "PersistedSettlementStatus" NOT NULL DEFAULT 'pending',
    "tx_hash" TEXT,
    "unsigned_transaction" TEXT,
    "estimated_completion_ms" INTEGER,
    "compliance_hash" TEXT,
    "travel_rule_payload" JSONB,
    "corridor" TEXT,
    "fx_rate" DOUBLE PRECISION,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "framework" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ready',
    "download_url" TEXT,
    "file_size_bytes" INTEGER,
    "period_from" TIMESTAMP(3) NOT NULL,
    "period_to" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_events_wallet_address_idx" ON "audit_events"("wallet_address");

-- CreateIndex
CREATE INDEX "kyc_requests_wallet_address_idx" ON "kyc_requests"("wallet_address");

-- CreateIndex
CREATE INDEX "aml_screenings_wallet_address_idx" ON "aml_screenings"("wallet_address");

-- CreateIndex
CREATE INDEX "settlements_initiator_wallet_idx" ON "settlements"("initiator_wallet");

-- CreateIndex
CREATE INDEX "settlements_receiver_wallet_idx" ON "settlements"("receiver_wallet");

-- CreateIndex
CREATE INDEX "reports_wallet_address_idx" ON "reports"("wallet_address");
