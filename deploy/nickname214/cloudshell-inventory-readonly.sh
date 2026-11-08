#!/usr/bin/env bash
# Run by the operator in existing AWS CloudShell. No deploy, rollback or resource creation.
set -euo pipefail
region=us-east-2
instance=i-027325f2e81d40585
test "$(aws sts get-caller-identity --query Account --output text)" = 988024221050
aws ssm describe-instance-information --region "$region" \
  --filters "Key=InstanceIds,Values=$instance" \
  --query 'InstanceInformationList[].{Id:InstanceId,Ping:PingStatus,Platform:PlatformName,Version:PlatformVersion,Agent:AgentVersion}'
# Uses the existing AWS-managed document. SendCommand runs only the read operations below.
params=$(mktemp)
trap 'rm -f "$params"' EXIT
cat > "$params" <<'JSON'
{"commands":["set -eu","uname -sm","cat /proc/1/comm","/usr/bin/node-22 --version","readlink -f /opt/xamuko/deploy/current","readlink -f /opt/xamuko/deploy/previous","systemctl show xamuko-api -p User -p WorkingDirectory -p EnvironmentFiles -p MainPID","python3 - <<'PY'\nimport subprocess,json\nfrom pathlib import Path\nr='/opt/xamuko/deploy/current'\ns=subprocess.check_output(['systemctl','show','xamuko-api','-p','ExecStart','--value'],text=True)\nprint(json.dumps({'execStartMatches': 'path=/usr/bin/node-22 ;' in s and 'argv[]=/usr/bin/node-22 '+r+'/backend/dist/server.js ;' in s,'readyExists':Path('/opt/xamuko/deploy/READY').exists(),'envBackupExists':Path('/opt/xamuko/deploy/backups/xamuko-api.env.flkDMQfb').is_file()}))\nPY","stat -c '%U %a %n' /opt/xamuko/deploy/current/xamuko-api.env /usr/local/sbin/xamuko-verify-persistent-storage","sha256sum /usr/local/sbin/xamuko-verify-persistent-storage"],"executionTimeout":["60"]}
JSON
command_id=$(aws ssm send-command --region "$region" --instance-ids "$instance" \
  --document-name AWS-RunShellScript --parameters "file://$params" \
  --comment 'PR215 read-only compatibility inventory; no deployment' \
  --query Command.CommandId --output text)
printf 'CommandId: %s\n' "$command_id"
aws ssm wait command-executed --region "$region" --command-id "$command_id" --instance-id "$instance" || true
aws ssm get-command-invocation --region "$region" --command-id "$command_id" --instance-id "$instance" \
  --query '{Status:Status,ResponseCode:ResponseCode,Output:StandardOutputContent,Error:StandardErrorContent}'
