#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
export PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
mode=${1:-validate}
base=${XAMUKO_DEPLOY_BASE:-/opt/xamuko/deploy}
[[ $EUID == 0 ]] || exit 64
[[ $mode == validate || $mode == --activate ]] || { echo 'Usage: install-github-release-poll.sh [validate|--activate]' >&2; exit 64; }
[[ -d $base && -f $base/READY && -d $base/releases ]] || { echo 'Existing deployment directory with READY/releases required' >&2; exit 78; }
service_workdir=$(systemctl show xamuko-api -p WorkingDirectory --value)
[[ $service_workdir == "$base"/releases/*/backend ]] || { echo 'xamuko-api is not using a managed release' >&2; exit 78; }
current_release=${service_workdir%/backend}
[[ -f "$current_release/backend/xamuko-api.env" ]] || { echo 'xamuko-api.env missing from active release' >&2; exit 78; }
[[ $(stat -c '%a' "$current_release/backend/xamuko-api.env") == 600 ]] || { echo 'xamuko-api.env must be mode 600' >&2; exit 78; }
[[ $(systemctl show xamuko-api -p User --value) == ssm-user ]] || { echo 'xamuko-api must run as ssm-user' >&2; exit 78; }
[[ $mode == --activate ]] || { echo 'Validation passed; production remains unchanged' >&2; exit 0; }
here=$(cd "$(dirname "$0")" && pwd)
install -m 0755 "$here/deploy-github-release.sh" /usr/local/sbin/xamuko-deploy-github-release
install -m 0755 "$here/github-release-poll.sh" /usr/local/sbin/xamuko-github-release-poll
ln -sfn "$current_release" "$base/.current-next"
mv -Tf "$base/.current-next" "$base/current"
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
