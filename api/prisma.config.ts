// Central Prisma config (replaces deprecated "package.json#prisma")
import { defineConfig } from '@prisma/config';

export default defineConfig({
  // Default schema for dev; override with PRISMA_SCHEMA when needed (CI/PG).
  schema: process.env.PRISMA_SCHEMA ?? './prisma/schema.sqlite.prisma',
});
