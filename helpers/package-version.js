const fs = require('fs');

const PACKAGE_JSON = 'package.json';
const PACKAGE_LOCK = 'package-lock.json';

function readPackageJson(packageJsonPath = PACKAGE_JSON) {
  return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
}

function writePackageJson(packageJson, packageJsonPath = PACKAGE_JSON) {
  fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

/**
 * Updates root version fields in package-lock.json without running npm install.
 *
 * @param {string} newVersion
 * @param {string} [lockfilePath]
 * @returns {boolean} true if the lockfile was updated
 */
function patchPackageLockVersion(newVersion, lockfilePath = PACKAGE_LOCK) {
  if (!fs.existsSync(lockfilePath)) {
    return false;
  }

  const lock = JSON.parse(fs.readFileSync(lockfilePath, 'utf8'));

  if (typeof lock.version === 'string') {
    lock.version = newVersion;
  }

  if (lock.packages && Object.prototype.hasOwnProperty.call(lock.packages, '')) {
    lock.packages[''].version = newVersion;
  }

  fs.writeFileSync(lockfilePath, `${JSON.stringify(lock, null, 2)}\n`);
  return true;
}

/**
 * Writes the new version to package.json and package-lock.json (when present).
 *
 * @param {string} newVersion
 * @param {{ packageJson?: object, packageJsonPath?: string, lockfilePath?: string }} [options]
 * @returns {{ packageJson: object, lockfileUpdated: boolean }}
 */
function patchPackageVersion(newVersion, options = {}) {
  const packageJsonPath = options.packageJsonPath || PACKAGE_JSON;
  const lockfilePath = options.lockfilePath || PACKAGE_LOCK;
  const packageJson = options.packageJson || readPackageJson(packageJsonPath);
  const updatedPackageJson = { ...packageJson, version: newVersion };

  writePackageJson(updatedPackageJson, packageJsonPath);
  const lockfileUpdated = patchPackageLockVersion(newVersion, lockfilePath);

  return {
    packageJson: updatedPackageJson,
    lockfileUpdated,
  };
}

/**
 * Restores package.json and package-lock.json from a previous package.json snapshot.
 *
 * @param {object} packageJsonSnapshot
 * @param {{ packageJsonPath?: string, lockfilePath?: string }} [options]
 */
function restorePackageVersion(packageJsonSnapshot, options = {}) {
  const packageJsonPath = options.packageJsonPath || PACKAGE_JSON;
  const lockfilePath = options.lockfilePath || PACKAGE_LOCK;

  writePackageJson(packageJsonSnapshot, packageJsonPath);
  patchPackageLockVersion(packageJsonSnapshot.version, lockfilePath);
}

module.exports = {
  PACKAGE_JSON,
  PACKAGE_LOCK,
  readPackageJson,
  patchPackageVersion,
  restorePackageVersion,
  patchPackageLockVersion,
};
