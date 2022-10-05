const core = require('@actions/core');
const github = require('@actions/github');
const shell = require('shelljs');

try {
  if (!shell.which('git')) {
    shell.echo('\nSorry, this script requires git');
    shell.exit(1);
  }

  shell.echo('\nChecking commit messages for `feat: `');

  const currentBranch = shell
    .exec('git rev-parse --abbrev-ref HEAD', { silent: true })
    .stdout.trim();
  shell.echo(`\nCurrent branch: ${currentBranch}`);
  if (currentBranch === 'main') {
    shell.echo(
      '\nYou are on the main branch. Please switch to a feature branch before running this script.'
    );
    shell.exit(1);
  }

  const commitMessages = shell.exec(`git log --oneline main...${currentBranch}`, {
    silent: true,
  }).stdout;

  const hasFeatureCommit = commitMessages.split('\n').some((commit) => commit.includes('feat: '));

  const hasReleaseNotesChanged = shell
    .exec('git diff --name-only main...HEAD', { silent: true })
    .stdout.includes('release.md');

  if (!hasFeatureCommit && !hasReleaseNotesChanged) {
    shell.echo('\nNo feature commits or release notes changes found. Exiting.');
    shell.exit(0);
  }

  if (hasFeatureCommit && !hasReleaseNotesChanged) {
    shell.echo('\nFeature commits found but no release notes changes found. Exiting.');
    shell.exit(1);
  }
  if (hasReleaseNotesChanged && !hasFeatureCommit) {
    shell.echo('\nRelease notes changes found but no feature commits found. Exiting.');
    shell.exit(1);
  }

  shell.echo('\nFeature commits and release notes changes found. Proceeding.');

  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const OLD_VERSION = packageJson.version;
  const [major, minor, patch] = OLD_VERSION.split('.');
  const NEW_VERSION = `${major}.${parseInt(minor, 10) + 1}.${patch}`;

  console.log(OLD_VERSION);
  console.log(NEW_VERSION);

  // prepend version to release notes
  const releaseNotes = fs.readFileSync('./src/release.md', 'utf8');

  if (releaseNotes.startsWith(`#### v`)) {
    const releaseNotesArray = releaseNotes.split('\n').filter(Boolean);
    const releaseNotesVersion = releaseNotesArray[0].replace('#### v', '');
    shell.echo('\nRelease notes already have version at start');
    if (releaseNotesVersion.toString() === OLD_VERSION.toString()) {
      shell.echo('\nRelease notes version is equal to old version. Exiting.');
      shell.exit(1);
    }

    if (releaseNotesVersion.toString() !== NEW_VERSION.toString()) {
      shell.echo('\nRelease notes version is not equal to new version. Exiting.');
      shell.echo(
        '\nEither updated release notes version to match new version \nor remove version from release notes and this script will automagically add the correct one.'
      );
      shell.exit(1);
    }
  }

  try {
    const copyPackageJson = { ...packageJson };
    copyPackageJson.version = NEW_VERSION;
    fs.writeFileSync('package.json', `${JSON.stringify(copyPackageJson, null, 2)}\n`);

    shell.echo('\nPackage.json version updated');

    const newReleaseNotes = `#### v${NEW_VERSION}\n${releaseNotes}`;
    fs.writeFileSync('./src/release.md', newReleaseNotes);

    shell.echo('\nRelease notes updated version updated');

    if (shell.exec('git commit -am "chore: update version"').code !== 0) {
      shell.echo('\nError committing changes. Exiting.');
      throw new Error('Error committing changes');
    }
  } catch (e) {
    shell.echo(e);
    try {
      // try to revert changes if there was an error
      fs.writeFileSync('package.json', `${JSON.stringify(packageJson, null, 2)}\n`);
      shell.echo('\nPackage.json version reverted');
      fs.writeFileSync('./src/release.md', releaseNotes);
      shell.echo('\nRelease notes version reverted');
      shell.exit(1);
    } catch (error) {
      // if there was an error reverting changes, exit
      shell.echo(`\nError reverting package.json and release notes changes: ${error}`);
      shell.echo(error);
      shell.exit(1);
    }
  }
} catch (error) {
  core.setFailed(error.message);
}
