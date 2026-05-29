#!/usr/bin/env node

const { incrementVersion } = require('../helpers/release');
const { readPackageJson, patchPackageVersion } = require('../helpers/package-version');

const RELEASE_TYPES = ['patch', 'minor', 'major'];

function bumpVersion(releaseType) {
  if (!RELEASE_TYPES.includes(releaseType)) {
    throw new Error(`Invalid release type: ${releaseType}. Use one of: ${RELEASE_TYPES.join(', ')}`);
  }

  const packageJson = readPackageJson();
  const oldVersion = packageJson.version;
  const newVersion = incrementVersion(oldVersion, releaseType);

  patchPackageVersion(newVersion, { packageJson });

  return { oldVersion, newVersion, releaseType };
}

function printUsage() {
  console.error('Usage: npm run version:<patch|minor|major>');
  console.error('       node scripts/bump-version.js <patch|minor|major>');
}

if (require.main === module) {
  const releaseType = process.argv[2];

  if (!releaseType || releaseType === '-h' || releaseType === '--help') {
    printUsage();
    process.exit(releaseType ? 0 : 1);
  }

  try {
    const { oldVersion, newVersion } = bumpVersion(releaseType);
    console.log(`${oldVersion} -> ${newVersion}`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

module.exports = { bumpVersion };
