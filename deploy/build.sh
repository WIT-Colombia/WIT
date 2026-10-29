#!/usr/bin/env bash
# Installed separately by the administrator; never run repository scripts as root.
set -Eeuo pipefail
cd "$1"
export NODE_ENV=test
export DATABASE_URL=mysql://test:test@127.0.0.1:3306/xamuko_test
export AUTH_ACCESS_TOKEN_SECRET=ci-test-secret-not-for-production-0123456789
export GOOGLE_CLIENT_ID=xamuko-test.apps.googleusercontent.com
export GOOGLE_CLIENT_SECRET=test-secret-not-real
cd backend
npm ci --no-audit --no-fund
npm run prisma:generate
npm run typecheck
npm test
npm run build
cd ../frontend
npm ci --no-audit --no-fund
npm run typecheck
npm run test:verification
npm run build
