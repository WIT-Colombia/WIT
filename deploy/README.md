# XAMUKO: staging → EC2

## Scope and activation

This implementation is opt-in: CI runs for PRs targeting staging and staging pushes;
deployment is skipped until `XAMUKO_DEPLOY_ENABLED=true`. Do not set that flag until
the server bootstrap, IAM stack and a supervised first deployment are verified.
The deployment destination is the PUBLIC site, not an isolated test environment.
Only Usuario is published; all four frontend apps are compiled and checked.

### Current account: pull deployment without a plan change

The IAM console explicitly reports identity providers unavailable until advanced
features are activated. OIDC provisioning is therefore optional and NOT active.
For this account use the server-side poller after bootstrap and supervised tests:

```bash
sudo bash deploy/install-poll.sh
```

It checks GitHub's public API every five minutes, requires the latest push run
of staging-deploy.yml for the current staging HEAD to have completed successfully,
then invokes the same fixed-commit deployment wrapper. No GitHub token, AWS access
key, self-hosted Actions runner, new IAM permission or inbound port is needed.
Keep XAMUKO_DEPLOY_ENABLED unset/false in this mode so the OIDC job is skipped.
Do not enable both deployment transports at once.

The last attempted SHA is recorded before execution. Failures do not retry forever;
manual rollback is retained until another staging commit. To pause:
`sudo systemctl stop xamuko-poll.timer` and remove the POLL_ENABLED marker.
Review failures with `sudo journalctl -u xamuko-poll.service` (administrator only).
An API outage or rate limit fails closed. Five-minute polling is not instantaneous.
The Actions page shows CI; deployment results are recorded on EC2, not posted back
to GitHub. Manual rollback in this mode uses the server command below, not Actions.

Activate advanced features only through a separate explicit account decision.
AWS describes these restrictions here:
https://docs.aws.amazon.com/accounts/latest/reference/sign-up-for-aws.html

Inspected on 2026-10-28:

- AWS account 988024221050, region us-east-2, instance i-0bc484a461397e2b1.
- SSM session works; instance role is `xamuko-ec2-ssm-role` and cannot manage IAM.
- Node 24, x86_64; service runs as ssm-user from /opt/xamuko/api/backend.
- Nginx root /var/www/xamuko, /api/v1/ proxies to 127.0.0.1:3000.
- Backend reads its existing mode-600 .env. Its contents were not retrieved.
- Server checkout staging and GitHub initially matched 4eabffda337a165d7e9cb23680a55705ae40c84e.
- GitHub OIDC uses immutable subject IDs (confirmed through GitHub API).
- SSM Agent 3.3.5390.0 supports ENV_VAR interpolation; port 3001 was unused.
- Instance has about 913 MiB RAM and 1 GiB swap. Builds are limited to 384 MiB
  RAM, 512 MiB swap, 50% of one CPU and 30 minutes; exhaustion fails before
  switching traffic. Monitor impact during the supervised first build.

## Architecture

1. CI: locked npm installs, Prisma generation, typechecks, 84 backend tests,
   9 frontend verification tests, backend build and all frontend builds.
2. A separate job obtains short-lived AWS credentials through OIDC. The trust
   is restricted to this repository's immutable IDs and refs/heads/staging.
3. The role can send only `Xamuko-Staging-Deploy` to this one EC2 instance.
   It cannot send AWS-RunShellScript, edit SSM documents or IAM, or access secrets.
   GetCommandInvocation requires Resource `*` and exposes command results.
4. The root-owned installed wrapper fetches the exact staging HEAD. If staging
   moved while CI ran, the older deployment fails safely. It builds again on
   EC2 to avoid platform-specific dependency mismatches.
5. Builds run as a dedicated user, without sudo/new privileges, with a read-only
   system and blocked EC2/container metadata addresses. Backend runtime secrets
   are not injected into builds. A loopback smoke process runs on port 3001.
6. A symlink switch selects the tested web/API release. Nginx remains running;
   API restart may briefly interrupt API requests. This is not zero-downtime API
   deployment. Failed activation restores the previous symlink and restarts API.

## One-time setup (administrator)

Before running anything, review the scripts at a fixed commit. The repository
is public; never place private configuration in these files or SSM parameters.

1. Confirm SSM Agent supports ENV_VAR parameter interpolation (3.3.2746.0+),
   required executables exist, port 3001 is unused, current health is good and
   there is at least 4 GiB free. Confirm existing Prisma matches staging.
2. Run `sudo bash deploy/bootstrap.sh` from the reviewed checkout. It retains
   the original web and backend directories, copies a baseline and config
   backups under /opt/xamuko/deploy, installs root-owned scripts, configures
   Nginx to current/web and a systemd drop-in for current/backend. Nginx is
   checked before reload. API is not restarted during bootstrap.
3. Review /etc/xamuko-deploy/frontend.env: only PUBLIC Vite variables belong
   there. It starts empty because no production frontend .env was found in
   the inspected source checkout. Backend .env stays in its original location.
4. Inspect IAM for an existing token.actions.githubusercontent.com provider.
   Deploy aws-stack.json in us-east-2 with CAPABILITY_NAMED_IAM. Supply its ARN
   in ExistingOidcProviderArn when one exists; otherwise leave empty. This
   creates the OIDC provider if needed, deploy role and SSM document. It does
   not modify the EC2 instance role, security groups, certificates or AWS plan.
5. Set repository variable XAMUKO_DEPLOY_ROLE_ARN to the stack output. Restrict
   staging writers and review workflow changes: write access to staging can
   publish arbitrary application code on this server. Do not add a GitHub
   environment without updating the OIDC subject condition accordingly.
6. After merging the reviewed PR into staging, run the installed wrapper once
   with the exact merged commit through SSM. Verify root page, static assets,
   API and key user flows; test rollback to bootstrap and reactivation under
   supervision. Only then set XAMUKO_DEPLOY_ENABLED=true and run the workflow.

Example administrator command after bootstrap (replace SHA with actual HEAD):

```bash
sudo /usr/local/sbin/xamuko-deploy deploy SHA
```

The workflow pins SSM document version 1. Future document/script upgrades require
explicit review and updating the pinned version; they are not self-updated by CI.

## Rollback and recovery

Use Actions → XAMUKO staging → Run workflow → branch staging → action rollback
and a previously verified 40-character commit, or `bootstrap` for the original
site. CI still runs first. For emergency recovery independent of GitHub:

```bash
sudo /usr/local/sbin/xamuko-deploy rollback bootstrap
```

Inspect /opt/xamuko/deploy/history.log, current and previous plus the SSM command
status. Do not retry blindly after a workflow timeout: a remote command can still
be running. A host flock prevents overlapping deployment/rollback commands.

If bootstrap itself needs reverting, restore the saved Nginx config from
/opt/xamuko/deploy/backups/xamuko-web.conf, remove only the added
/etc/systemd/system/xamuko-api.service.d/deploy.conf, validate Nginx, daemon-reload,
reload Nginx and restart API during an agreed maintenance window. Original
/var/www/xamuko and /opt/xamuko/api/backend remain available.

## Data, backups and limits

- No migrations run automatically. Any change under backend/prisma blocks
  deployment/rollback until a separate reviewed migration/recovery plan exists.
- Code releases, config backups and original directories are retained. Hashed
  frontend assets are shared and retained so cached pages survive switching
  and rollback. Nothing is pruned automatically; monitor disk space. Deploys
  refuse to start below 4 GiB free.
- Uploaded storage and backend .env are shared from the original backend path.
  Existing external PHOTO_STORAGE_DIR / verification paths remain unchanged.
- These are LOCAL code/config recovery copies, not off-instance backups or a
  database backup. There is no DB restore step; rollback does not undo user data.
- /health proves process responsiveness, not database readiness or complete
  business functionality. Database-dependent and browser E2E checks remain a
  separate validation requirement.
- Run Command on EC2 has no additional SSM charge per AWS documentation:
  https://docs.aws.amazon.com/systems-manager/latest/userguide/run-command.html
  EC2 CPU, storage, network and GitHub Actions quotas still apply. No paid AWS
  plan change is requested or made; account-specific service restrictions must
  still be checked when creating the stack.
- OIDC reference (including immutable subjects):
  https://docs.github.com/en/actions/reference/security/oidc

## Status of this change

Repository implementation and local checks are separate from activation.
Until AWS provisioning, bootstrap and the supervised deployment/rollback are
confirmed, this is a prepared deployment mechanism, not an active pipeline.
