-- CreateEnum
CREATE TYPE "promagen20"."Provider" AS ENUM ('openai', 'stability', 'leonardo', 'deepai', 'google_imagen', 'lexica', 'novelai', 'edenai', 'runware', 'hive', 'recraft', 'artistly', 'canva', 'adobe_firefly', 'midjourney', 'bing_image_creator', 'nightcafe', 'playground', 'pixlr', 'fotor');

-- CreateTable
CREATE TABLE "promagen20"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promagen20"."Key" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "promagen20"."Provider" NOT NULL,
    "cipherText" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Key_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promagen20"."Metric" (
    "id" TEXT NOT NULL,
    "provider" "promagen20"."Provider" NOT NULL,
    "category" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Metric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promagen20"."Score" (
    "id" TEXT NOT NULL,
    "provider" "promagen20"."Provider" NOT NULL,
    "total" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Score_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promagen20"."Override" (
    "id" TEXT NOT NULL,
    "provider" "promagen20"."Provider" NOT NULL,
    "category" TEXT NOT NULL,
    "delta" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Override_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "promagen20"."User"("email");

-- AddForeignKey
ALTER TABLE "promagen20"."Key" ADD CONSTRAINT "Key_userId_fkey" FOREIGN KEY ("userId") REFERENCES "promagen20"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
