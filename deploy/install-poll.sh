#!/usr/bin/env bash
set -Eeuo pipefail
[[ $EUID == 0 && -f /opt/xamuko/deploy/READY ]] || exit 64
here=$(cd "$(dirname "$0")" && pwd)
install -m 0755 "$here/poll.sh" /usr/local/sbin/xamuko-poll
cat > /etc/systemd/system/xamuko-poll.service <<'UNIT'
[Unit]
Description=Deploy verified XAMUKO staging commits from GitHub
After=network-online.target
Wants=network-online.target
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/xamuko-poll
TimeoutStartSec=2700
UNIT
cat > /etc/systemd/system/xamuko-poll.timer <<'UNIT'
[Unit]
Description=Check verified XAMUKO staging commits every five minutes
[Timer]
OnBootSec=2min
OnUnitInactiveSec=5min
RandomizedDelaySec=30
Unit=xamuko-poll.service
[Install]
WantedBy=timers.target
UNIT
if [[ -f /opt/xamuko/deploy/current/COMMIT ]]; then
  cp /opt/xamuko/deploy/current/COMMIT /opt/xamuko/deploy/last-attempt
fi
touch /opt/xamuko/deploy/POLL_ENABLED
systemctl daemon-reload
systemctl enable --now xamuko-poll.timer
