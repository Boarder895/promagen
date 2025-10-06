-- CreateTable
CREATE TABLE "promagen20"."ProviderSnapshotBatch" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderSnapshotBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promagen20"."Provider" (
    "id" VARCHAR(64) NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Provider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promagen20"."ProviderSnapshot" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "latencyMs" INTEGER,
    "score" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promagen20"."ProviderOverride" (
    "id" SERIAL NOT NULL,
    "providerId" TEXT NOT NULL,
    "scoreAdjustment" INTEGER NOT NULL DEFAULT 0,
    "isHardOverride" BOOLEAN NOT NULL DEFAULT false,
    "finalScore" INTEGER,
    "notes" TEXT,
    "updatedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProviderOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProviderSnapshot_providerId_idx" ON "promagen20"."ProviderSnapshot"("providerId");

-- CreateIndex
CREATE INDEX "ProviderSnapshot_batchId_idx" ON "promagen20"."ProviderSnapshot"("batchId");

-- CreateIndex
CREATE INDEX "ProviderOverride_providerId_idx" ON "promagen20"."ProviderOverride"("providerId");

-- AddForeignKey
ALTER TABLE "promagen20"."ProviderSnapshot" ADD CONSTRAINT "ProviderSnapshot_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "promagen20"."ProviderSnapshotBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promagen20"."ProviderOverride" ADD CONSTRAINT "ProviderOverride_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "promagen20"."Provider"("id") ON DELETE CASCADE ON UPDATE CASCADE;
