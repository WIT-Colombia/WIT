#!/usr/bin/env bash
set -Eeuo pipefail
for f in deploy/bootstrap.sh deploy/deploy-github-release.sh deploy/github-release-poll.sh deploy/install-github-release-poll.sh deploy/verify-persistent-storage.sh; do
  bash -n "$f"
done
grep -q 'integration/preserve-all-20261029' .github/workflows/backend-release-package.yml
grep -q 'github.event_name == .push. && github.ref == .refs/heads/integration/preserve-all-20261029.' .github/workflows/backend-release-package.yml
grep -q 'actions/workflows' deploy/github-release-poll.sh
grep -q 'head_sha.*sha' deploy/github-release-poll.sh
grep -q 'conclusion.*success' deploy/github-release-poll.sh
grep -q 'target_commitish' deploy/github-release-poll.sh
grep -q 'github-release-last-success' deploy/github-release-poll.sh
! grep -q 'github-release-last-attempt' deploy/github-release-poll.sh
grep -q 'sha256sum -c' deploy/github-release-poll.sh
grep -q 'xamuko-api.env' deploy/deploy-github-release.sh
grep -q 'smoke_ok' deploy/deploy-github-release.sh
grep -q 'healthy' deploy/deploy-github-release.sh
grep -q 'rollback' deploy/deploy-github-release.sh
grep -Fq 'storage_mode=$(/usr/local/sbin/xamuko-verify-persistent-storage "$old")' deploy/deploy-github-release.sh
grep -Fq 'chmod 0755 "$release" "$release/backend"' deploy/deploy-github-release.sh
grep -Fq 'ln -s "$persistent_storage" "$release/backend/storage"' deploy/deploy-github-release.sh
grep -Fq 'set +e' deploy/deploy-github-release.sh
grep -Fq "El puerto 3001 de prueba esta ocupado" deploy/deploy-github-release.sh
grep -Fq 'smoke_pid=' deploy/deploy-github-release.sh
grep -Fq 'Any explicit environment override takes precedence' deploy/verify-persistent-storage.sh
grep -Fq '127.0.0.1:1/smoke' deploy/deploy-github-release.sh
grep -Fq 'No es seguro activar: almacenamiento persistente sin validar' deploy/install-github-release-poll.sh
grep -Fq 'ENV_ONLY' deploy/verify-persistent-storage.sh
grep -Fq 'LINK %s' deploy/verify-persistent-storage.sh
grep -q 'validate-only' deploy/bootstrap.sh
grep -q 'mode=\${1:-validate}' deploy/install-github-release-poll.sh
grep -q 'Validation passed; production remains unchanged' deploy/install-github-release-poll.sh
grep -q 'amazonlinux:2023' .github/workflows/backend-release-package.yml
grep -q 'argon2' .github/workflows/backend-release-package.yml
grep -q 'mariadb' .github/workflows/backend-release-package.yml
! grep -q 'configure-aws-credentials' deploy/github-release-poll.sh
echo 'GitHub release deployment regression checks passed'
