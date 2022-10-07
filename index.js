/* eslint-disable no-console */
/* eslint-disable import/no-extraneous-dependencies */
const core = require('@actions/core');
const shell = require('shelljs');
const fs = require('fs');
const conventionalRecommendedBump = require('conventional-recommended-bump');
const git = require('./helpers/git');

async function run() {
  const gitBranch = core.getInput('git-branch').replace('refs/heads/', '');
  conventionalRecommendedBump(
    {
      preset: 'angular',
    },
    async (err, reccomendation) => {
      if (err) {
        console.log('error reccommending bump', err);
        shell.exit(1);
      }
      console.log('err : ', err);
      console.log('releaseType : ', JSON.stringify(reccomendation));
      const { releaseType } = reccomendation;
      const releaseTypeMap = {
        major: 'major',
        minor: 'minor',
        patch: 'patch',
      };
      const releaseTypeLabel = releaseTypeMap[releaseType];
      const releaseTypeLabelCapitalized =
        releaseTypeLabel.charAt(0).toUpperCase() + releaseTypeLabel.slice(1);
      const releaseTypeLabelEmoji = {
        major: '🚨',
        minor: '✨',
        patch: '🐛',
      };
      const releaseTypeEmoji = releaseTypeLabelEmoji[releaseType];

      const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      const OLD_VERSION = packageJson.version;
      let [major, minor, patch] = OLD_VERSION.split('.');
      const releaseMessage = `chore: ${releaseTypeEmoji} ${releaseTypeLabelCapitalized} release`;
      switch (releaseType) {
        case 'major':
          major = parseInt(major, 10) + 1;
          minor = 0;
          patch = 0;
          break;
        case 'minor':
          minor = parseInt(minor, 10) + 1;
          patch = 0;
          break;
        case 'patch':
          patch = parseInt(patch, 10) + 1;
          break;
        default:
          break;
      }
      const NEW_VERSION = [major, minor, patch].join('.');

      shell.echo(`\nOld version: ${OLD_VERSION}`);
      shell.echo(`New version: ${NEW_VERSION}`);

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
        await git.add('.');
        await git.commit(releaseMessage);
        await git.createTag(`v${NEW_VERSION}`);
        await git.push(gitBranch);
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
    }
  );

  // shell.echo(`\nCommit messages:\n${commitMessages}`);

  // const hasFeatureCommit = commitMessages.split('\n').some((commit) => commit.includes('feat: '));

  // const hasReleaseNotesChanged = shell
  //   .exec('git diff --name-only main...HEAD', { silent: true })
  //   .stdout.includes('release.md');

  // if (!hasFeatureCommit && !hasReleaseNotesChanged) {
  //   shell.echo('\nNo feature commits or release notes changes found. Exiting.');
  //   shell.exit(0);
  // }

  // if (hasFeatureCommit && !hasReleaseNotesChanged) {
  //   shell.echo('\nFeature commits found but no release notes changes found. Exiting.');
  //   shell.exit(1);
  // }
  // if (hasReleaseNotesChanged && !hasFeatureCommit) {
  //   shell.echo('\nRelease notes changes found but no feature commits found. Exiting.');
  //   shell.exit(1);
  // }

  // shell.echo('\nFeature commits and release notes changes found. Proceeding.');

  // const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  // const OLD_VERSION = packageJson.version;
  // const [major, minor, patch] = OLD_VERSION.split('.');
  // const NEW_VERSION = `${major}.${parseInt(minor, 10) + 1}.${patch}`;

  // shell.echo(`\nOld version: ${OLD_VERSION}`);
  // shell.echo(`New version: ${NEW_VERSION}`);

  // prepend version to release notes
  // const releaseNotes = fs.readFileSync('./src/release.md', 'utf8');

  // if (releaseNotes.startsWith(`#### v`)) {
  //   const releaseNotesArray = releaseNotes.split('\n').filter(Boolean);
  //   const releaseNotesVersion = releaseNotesArray[0].replace('#### v', '');
  //   shell.echo('\nRelease notes already have version at start');
  //   if (releaseNotesVersion.toString() === OLD_VERSION.toString()) {
  //     shell.echo('\nRelease notes version is equal to old version. Exiting.');
  //     shell.exit(1);
  //   }

  //   if (releaseNotesVersion.toString() !== NEW_VERSION.toString()) {
  //     shell.echo('\nRelease notes version is not equal to new version. Exiting.');
  //     shell.echo(
  //       '\nEither updated release notes version to match new version \nor remove version from release notes and this script will automagically add the correct one.'
  //     );
  //     shell.exit(1);
  //   }
  // }

  // try {
  //   const copyPackageJson = { ...packageJson };
  //   copyPackageJson.version = NEW_VERSION;
  //   fs.writeFileSync('package.json', `${JSON.stringify(copyPackageJson, null, 2)}\n`);

  //   shell.echo('\nPackage.json version updated');

  //   const newReleaseNotes = `#### v${NEW_VERSION}\n${releaseNotes}`;
  //   fs.writeFileSync('./src/release.md', newReleaseNotes);

  //   shell.echo('\nRelease notes updated version updated');

  //   if (shell.exec('git commit -am "chore: update version"').code !== 0) {
  //     shell.echo('\nError committing changes. Exiting.');
  //     throw new Error('Error committing changes');
  //   }
  // } catch (e) {
  //   shell.echo(e);
  //   try {
  //     // try to revert changes if there was an error
  //     fs.writeFileSync('package.json', `${JSON.stringify(packageJson, null, 2)}\n`);
  //     shell.echo('\nPackage.json version reverted');
  //     fs.writeFileSync('./src/release.md', releaseNotes);
  //     shell.echo('\nRelease notes version reverted');
  //     shell.exit(1);
  //   } catch (error) {
  //     // if there was an error reverting changes, exit
  //     shell.echo(`\nError reverting package.json and release notes changes: ${error}`);
  //     shell.echo(error);
  //     shell.exit(1);
  //   }
  // }
}
try {
  run();
} catch (error) {
  core.setFailed(error.message);
}
