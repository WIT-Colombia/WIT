#!/usr/bin/env bash
set -Eeuo pipefail
for f in deploy/deploy-github-release.sh deploy/github-release-poll.sh deploy/install-github-release-poll.sh; do
  bash -n "$f"
done
grep -q 'integration/preserve-all-20261029' .github/workflows/backend-release-package.yml
grep -q 'gh release create' .github/workflows/backend-release-package.yml
grep -q 'GITHUB_RELEASE_POLL_ENABLED' deploy/github-release-poll.sh
grep -q 'sha256sum -c' deploy/github-release-poll.sh
grep -q 'Prisma changes require manual review' deploy/deploy-github-release.sh
grep -q 'xamuko-api' deploy/deploy-github-release.sh
! grep -q 'configure-aws-credentials' deploy/github-release-poll.sh
echo 'GitHub release deployment tests passed'
