# ADR-0001: Root App Router Only

**Status:** Accepted  
**Date:** 2025-09-30

## Decision
Use the Next.js App Router from the project **root**: ./app/**.  
**Disallow** ./src/app/** entirely.

## Rationale
Avoids duplicate router trees, confusing imports, and inconsistent build behavior.

## Enforced by
- scripts/check-app-structure.ps1 (manual or pre-commit)
- Git pre-commit hook (core.hooksPath=.githooks)
- GitHub Actions workflow: app-structure.yml

## Migration note
If src/app ever reappears, move unique files to ./app/ and delete ./src/app/.