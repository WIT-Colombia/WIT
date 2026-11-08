import hashlib
import importlib.util
import io
import json
from pathlib import Path
import tarfile
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('procedure', Path(__file__).with_name('procedure.py'))
p = importlib.util.module_from_spec(spec)
spec.loader.exec_module(p)

class ProcedureTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name).resolve()

    def archive(self, extra=()):
        path = self.root / 'package.tar.gz'
        data = {'RELEASE_COMMIT': p.COMMIT, 'MANIFEST.json': json.dumps(dict(sourceSha=p.COMMIT, baseSha=p.BASE, platform='linux', arch='x64', node='v22.23.4')), 'dist/server.js': 'server'}
        data['FILES.sha256'] = ''.join(hashlib.sha256(v.encode()).hexdigest() + '  ' + k + '\n' for k, v in data.items())
        with tarfile.open(path, 'w:gz') as t:
            for name, body in data.items():
                m = tarfile.TarInfo(name); b = body.encode(); m.size = len(b); t.addfile(m, io.BytesIO(b))
            for m in extra:
                t.addfile(m, io.BytesIO(b'x' * m.size) if m.isfile() else None)
        return path

    def check_archive(self, extras):
        a = self.archive(extras)
        with self.assertRaises(RuntimeError):
            p.extract(a, self.root / 'out', p.digest(a))
        self.assertFalse((self.root / 'out').exists())

    def test_valid_archive(self):
        a = self.archive(); p.extract(a, self.root / 'out', p.digest(a))
        self.assertTrue((self.root / 'out/dist/server.js').exists())

    def test_bad_checksum(self):
        with self.assertRaises(RuntimeError): p.extract(self.archive(), self.root / 'out')

    def test_absolute(self): self.check_archive([tarfile.TarInfo('/tmp/pwn')])
    def test_traversal(self): self.check_archive([tarfile.TarInfo('dist/../../pwn')])
    def test_secret(self): self.check_archive([tarfile.TarInfo('dist/.env')])
    def test_duplicate(self): self.check_archive([tarfile.TarInfo('dist/server.js')])
    def test_device(self):
        m = tarfile.TarInfo('dist/device'); m.type = tarfile.CHRTYPE; self.check_archive([m])
    def test_hardlink(self):
        m = tarfile.TarInfo('dist/link'); m.type = tarfile.LNKTYPE; m.linkname = 'dist/server.js'; self.check_archive([m])
    def test_symlink_escape(self):
        m = tarfile.TarInfo('node_modules/link'); m.type = tarfile.SYMTYPE; m.linkname = '../../etc'; self.check_archive([m])
    def test_symlink_ancestor(self):
        m = tarfile.TarInfo('node_modules/link'); m.type = tarfile.SYMTYPE; m.linkname = 'safe'
        self.check_archive([m, tarfile.TarInfo('node_modules/link/file')])
    def test_setuid(self):
        m = tarfile.TarInfo('dist/binary'); m.mode = 0o4755; self.check_archive([m])

    def scenario(self, fail=None):
        root = self.root
        old = root / 'releases' / p.BASE; old.mkdir(parents=True)
        (old / 'xamuko-api.env').write_text('PRIVATE=do-not-use-in-smoke\n')
        (root / 'current').symlink_to(old)
        previous = root / 'releases/previous'; previous.mkdir()
        (root / 'previous').symlink_to(previous)
        (root / 'READY').write_text(f'nickname214 {p.COMMIT} {p.DIGEST}')
        calls = []
        def extract(a, dest):
            (dest / 'prisma').mkdir(parents=True)
            (dest / 'dist').mkdir(); (dest / 'dist/server.js').write_text('server')
            for name in ('package.json', 'package-lock.json', 'prisma.config.ts'):
                (dest / name).write_text('same'); (old / 'backend').mkdir(exist_ok=True); (old / 'backend' / name).write_text('same')
        def run(*args):
            calls.append(args)
            if args[0] == str(p.VERIFIER): return 'ENV_ONLY'
            if args[:3] == ('systemctl', 'show', 'xamuko-nickname214-smoke'): return '123'
            if args[0] == 'nsenter':
                if fail == 'smoke': raise RuntimeError('smoke failed')
                return '{"status":"ok","service":"wit-backend"}'
            return ''
        def health(release):
            if fail == 'activation' and release.name == p.COMMIT: raise RuntimeError('activation failed')
        with patch.multiple(p, ROOT=root), patch.object(p, 'protected'), patch.object(p, 'preflight', return_value=(old, 'page')), patch.object(p, 'extract', side_effect=extract), patch.object(p, 'tree', return_value={}), patch.object(p, 'run', side_effect=run), patch.object(p, 'health', side_effect=health), patch.object(p, 'frontend', return_value='page'), patch.object(p.time, 'sleep'):
            if fail:
                with self.assertRaises(RuntimeError): p.deploy('private-artifacts', 'version-123')
            else: p.deploy('private-artifacts', 'version-123')
        if fail:
            self.assertEqual((root / 'current').resolve(), old)
            self.assertEqual((root / 'previous').resolve(), previous)
            self.assertFalse((root / 'releases' / p.COMMIT).exists())
        else:
            self.assertEqual((root / 'current').resolve().name, p.COMMIT)
            self.assertTrue((root / 'current/VERIFIED').exists())
            self.assertEqual((root / 'previous').resolve(), old)
        self.assertEqual(sum(c == ('systemctl', 'restart', 'xamuko-api') for c in calls), 2 if fail == 'activation' else 0 if fail else 1)
        return calls

    def test_success(self): self.scenario()
    def test_smoke_failure_leaves_live_untouched(self): self.scenario('smoke')
    def test_activation_failure_recovers_exact_base(self): self.scenario('activation')
    def test_missing_ready_blocks_before_preflight(self):
        with patch.object(p, 'ROOT', self.root), self.assertRaises(FileNotFoundError): p.deploy('private-artifacts', 'v1')
    def test_null_s3_version_rejected(self):
        with self.assertRaises(RuntimeError): p.deploy('private-artifacts', 'null')

if __name__ == '__main__': unittest.main(verbosity=2)
