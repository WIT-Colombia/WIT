#!/usr/bin/env bash
set -Eeuo pipefail
[[ $EUID == 0 && -f /opt/xamuko/deploy/READY ]] || exit 64
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
touch /opt/xamuko/deploy/GITHUB_RELEASE_POLL_ENABLED
systemctl daemon-reload
systemctl enable --now xamuko-github-release-poll.timer
