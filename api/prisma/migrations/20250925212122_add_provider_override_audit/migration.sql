-- CreateTable
CREATE TABLE "promagen20"."ProviderOverrideAudit" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "prevScore" INTEGER,
    "newScore" INTEGER,
    "ip" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderOverrideAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProviderOverrideAudit_providerId_createdAt_idx" ON "promagen20"."ProviderOverrideAudit"("providerId", "createdAt");
