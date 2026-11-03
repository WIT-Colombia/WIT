#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
mode=${1:-validate}
base=${XAMUKO_DEPLOY_BASE:-/opt/xamuko/deploy}
[[ $EUID == 0 ]] || exit 64
[[ $mode == validate || $mode == --activate ]] || { echo 'Usage: install-github-release-poll.sh [validate|--activate]' >&2; exit 64; }
[[ -d $base && -L $base/current && -f $base/READY ]] || { echo 'Existing deployment layout with READY/current required' >&2; exit 78; }
current=$(readlink -f "$base/current")
[[ -f "$current/backend/xamuko-api.env" ]] || { echo 'xamuko-api.env missing from active release' >&2; exit 78; }
[[ $(stat -c '%a' "$current/backend/xamuko-api.env") == 600 ]] || { echo 'xamuko-api.env must be mode 600' >&2; exit 78; }
[[ $(systemctl show xamuko-api -p User --value) == ssm-user ]] || { echo 'xamuko-api must run as ssm-user' >&2; exit 78; }
[[ $mode == --activate ]] || { echo 'Validation passed; production remains unchanged' >&2; exit 0; }
here=$(cd "$(dirname "$0")" && pwd)
install -m 0755 "$here/deploy-github-release.sh" /usr/local/sbin/xamuko-deploy-github-release
install -m 0755 "$here/github-release-poll.sh" /usr/local/sbin/xamuko-github-release-poll
cat > /etc/systemd/system/xamuko-github-release-poll.service <<'UNIT'
[Unit]
Description=Deploy verified XAMUKO GitHub backend releases
After=network-online.target
Wants=network-online.target
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/xamuko-github-release-poll
TimeoutStartSec=2700
UNIT
cat > /etc/systemd/system/xamuko-github-release-poll.timer <<'UNIT'
[Unit]
Description=Check verified XAMUKO GitHub backend releases every five minutes
[Timer]
OnBootSec=2min
OnUnitInactiveSec=5min
RandomizedDelaySec=30
Unit=xamuko-github-release-poll.service
[Install]
WantedBy=timers.target
UNIT
touch "$base/GITHUB_RELEASE_POLL_ENABLED"
systemctl daemon-reload
systemctl enable --now xamuko-github-release-poll.timer
