const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const test = require('node:test');
const { bumpVersion } = require('../scripts/bump-version');
const {
  patchPackageLockVersion,
  patchPackageVersion,
  readPackageJson,
  restorePackageVersion,
} = require('../helpers/package-version');

function createFixtureDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'package-version-test-'));
}

test('patchPackageVersion updates package.json and lockfile', () => {
  const dir = createFixtureDir();
  const packageJsonPath = path.join(dir, 'package.json');
  const lockPath = path.join(dir, 'package-lock.json');

  fs.writeFileSync(
    packageJsonPath,
    `${JSON.stringify({ name: 'app', version: '1.0.0' }, null, 2)}\n`
  );
  fs.writeFileSync(
    lockPath,
    JSON.stringify({
      name: 'app',
      version: '1.0.0',
      lockfileVersion: 2,
      packages: {
        '': {
          name: 'app',
          version: '1.0.0',
        },
      },
    })
  );

  const packageJson = readPackageJson(packageJsonPath);
  const { lockfileUpdated } = patchPackageVersion('1.0.1', {
    packageJson,
    packageJsonPath,
    lockfilePath: lockPath,
  });

  assert.equal(lockfileUpdated, true);
  assert.equal(readPackageJson(packageJsonPath).version, '1.0.1');

  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  assert.equal(lock.version, '1.0.1');
  assert.equal(lock.packages[''].version, '1.0.1');

  fs.rmSync(dir, { recursive: true });
});

test('patchPackageVersion updates package.json when lockfile is missing', () => {
  const dir = createFixtureDir();
  const packageJsonPath = path.join(dir, 'package.json');

  fs.writeFileSync(
    packageJsonPath,
    `${JSON.stringify({ name: 'app', version: '2.0.0' }, null, 2)}\n`
  );

  const lockPath = path.join(dir, 'package-lock.json');
  const { lockfileUpdated } = patchPackageVersion('2.0.1', {
    packageJsonPath,
    lockfilePath: lockPath,
  });

  assert.equal(lockfileUpdated, false);
  assert.equal(readPackageJson(packageJsonPath).version, '2.0.1');

  fs.rmSync(dir, { recursive: true });
});

test('restorePackageVersion reverts package.json and lockfile', () => {
  const dir = createFixtureDir();
  const packageJsonPath = path.join(dir, 'package.json');
  const lockPath = path.join(dir, 'package-lock.json');
  const snapshot = { name: 'app', version: '1.0.0' };

  fs.writeFileSync(packageJsonPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  fs.writeFileSync(
    lockPath,
    JSON.stringify({
      name: 'app',
      version: '1.0.0',
      lockfileVersion: 2,
      packages: { '': { name: 'app', version: '1.0.0' } },
    })
  );

  patchPackageVersion('9.9.9', { packageJson: snapshot, packageJsonPath, lockfilePath: lockPath });
  restorePackageVersion(snapshot, { packageJsonPath, lockfilePath: lockPath });

  assert.equal(readPackageJson(packageJsonPath).version, '1.0.0');

  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf8'));
  assert.equal(lock.version, '1.0.0');
  assert.equal(lock.packages[''].version, '1.0.0');

  fs.rmSync(dir, { recursive: true });
});

test('bumpVersion increments package.json and lockfile', () => {
  const dir = createFixtureDir();
  const packageJsonPath = path.join(dir, 'package.json');
  const lockPath = path.join(dir, 'package-lock.json');

  fs.writeFileSync(
    packageJsonPath,
    `${JSON.stringify({ name: 'app', version: '0.1.11' }, null, 2)}\n`
  );
  fs.writeFileSync(
    lockPath,
    JSON.stringify({
      name: 'app',
      version: '0.1.11',
      lockfileVersion: 2,
      packages: { '': { name: 'app', version: '0.1.11' } },
    })
  );

  const cwd = process.cwd();
  process.chdir(dir);

  try {
    assert.deepEqual(bumpVersion('patch'), {
      oldVersion: '0.1.11',
      newVersion: '0.1.12',
      releaseType: 'patch',
    });
    assert.equal(readPackageJson(packageJsonPath).version, '0.1.12');
  } finally {
    process.chdir(cwd);
    fs.rmSync(dir, { recursive: true });
  }
});

test('patchPackageLockVersion returns false when lockfile is missing', () => {
  const dir = createFixtureDir();
  const lockPath = path.join(dir, 'missing-lock.json');

  assert.equal(patchPackageLockVersion('2.0.0', lockPath), false);

  fs.rmSync(dir, { recursive: true });
});
