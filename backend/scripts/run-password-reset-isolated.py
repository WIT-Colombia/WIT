#!/usr/bin/env python3
"""Create, verify and destroy a dedicated MySQL instance for opt-in password tests.
Never accepts a project DATABASE_URL or an existing datadir/socket.
"""
import argparse
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import tempfile
import time

parser = argparse.ArgumentParser()
parser.add_argument('--frontend-root', type=Path, help='Built frontend from PR #8 for browser checks')
args = parser.parse_args()
backend = Path(__file__).resolve().parents[1]
mysqld = shutil.which('mysqld')
mysql = shutil.which('mysql')
if not mysqld or not mysql:
    raise SystemExit('MySQL server and client are required; no existing database will be used.')

def run(command, **kwargs):
    return subprocess.run(command, check=True, **kwargs)

with tempfile.TemporaryDirectory(prefix='xamuko-joint-') as temporary:
    base = Path(temporary).resolve()
    data = base / 'data'
    data.mkdir()
    schema = 'xamuko_joint_' + secrets.token_hex(6)
    password = secrets.token_hex(24)
    with socket.socket() as reservation:
        reservation.bind(('127.0.0.1', 0))
        port = reservation.getsockname()[1]
    env = {**os.environ, 'DATABASE_URL': f'mysql://joint_runner:{password}@127.0.0.1:{port}/{schema}',
           'NODE_ENV': 'development', 'AUTH_ACCESS_TOKEN_SECRET': 'joint-test-only-not-production-0123456789',
           'EMAIL_MODE': 'development', 'RESEND_API_KEY': '', 'EMAIL_API_KEY': ''}
    run([mysqld, '--no-defaults', '--initialize-insecure', f'--datadir={data}', f'--log-error={base}/initialize.log'], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    (data / '.xamuko-isolated-password-reset').write_text(schema)
    process = subprocess.Popen([mysqld, '--no-defaults', f'--datadir={data}', f'--port={port}', '--bind-address=127.0.0.1',
                                f'--socket={base}/mysql.sock', f'--pid-file={base}/mysql.pid', f'--log-error={base}/mysql.log',
                                '--mysqlx=OFF', '--skip-log-bin', '--skip-name-resolve', '--max-connections=20', '--innodb-buffer-pool-size=64M'],
                               stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    client = [mysql, '--no-defaults', '--no-login-paths', f'--socket={base}/mysql.sock', '--protocol=SOCKET', '-uroot', '--batch', '--skip-column-names']
    try:
        ready = None
        for _ in range(150):
            if process.poll() is not None:
                raise RuntimeError('The isolated MySQL process stopped before readiness.')
            ready = subprocess.run(client + ['-e', 'SELECT @@datadir, @@port, VERSION()'], text=True, capture_output=True)
            if ready.returncode == 0:
                break
            time.sleep(0.1)
        if ready is None or ready.returncode != 0:
            raise RuntimeError('The dedicated MySQL socket did not become ready.')
        actual, actual_port, version = ready.stdout.strip().split('\t')
        if Path(actual).resolve() != data or int(actual_port) != port:
            raise RuntimeError('Isolation identity mismatch; refusing every schema/data write.')
        print(f'Verified dedicated MySQL {version}; no project database used.', flush=True)
        sql = (f'CREATE DATABASE `{schema}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;'
               f"CREATE USER 'joint_runner'@'127.0.0.1' IDENTIFIED BY '{password}';"
               f"GRANT ALL PRIVILEGES ON `{schema}`.* TO 'joint_runner'@'127.0.0.1';"
               "GRANT SELECT ON performance_schema.* TO 'joint_runner'@'127.0.0.1';"
               "GRANT PROCESS ON *.* TO 'joint_runner'@'127.0.0.1';")
        run(client, input=sql, text=True, stdout=subprocess.DEVNULL)
        # Generate fresh DDL; do not run or edit the repository's migration history.
        with (base / 'schema.sql').open('w') as output:
            run(['node', 'node_modules/prisma/build/index.js', 'migrate', 'diff', '--from-empty', '--to-schema', 'prisma/schema.prisma', '--script'], cwd=backend, env=env, stdout=output)
        with (base / 'schema.sql').open() as source:
            run(client + [schema], stdin=source, stdout=subprocess.DEVNULL)
        run(['npm', 'run', 'build'], cwd=backend, env=env)
        env['XAMUKO_ISOLATED_DATABASE_URL'] = env['DATABASE_URL']
        env['XAMUKO_ISOLATED_MYSQL_DATADIR'] = str(data)
        if args.frontend_root:
            env['XAMUKO_JOINT_FRONTEND_ROOT'] = str(args.frontend_root.resolve())
        else:
            env.pop('XAMUKO_JOINT_FRONTEND_ROOT', None)
        run(['node', '--test', 'scripts/password-reset-isolated.test.mjs'], cwd=backend, env=env)
    finally:
        # Only terminate the exact child process created above; never a service or external pid.
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=15)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
        print('Dedicated MySQL stopped; temporary data directory removed on exit.', flush=True)
