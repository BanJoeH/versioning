/* eslint-disable no-console */
/* eslint-disable import/no-extraneous-dependencies */
const core = require('@actions/core');
const fs = require('fs');
const conventionalRecommendedBump = require('conventional-recommended-bump');
const git = require('./helpers/git');
const exec = require('@actions/exec');

async function run() {
  let gitBranch = core.getInput('git-branch');
  // console.log(await git.exec(`rev-parse --abbrev-ref HEAD`));
  gitBranch = gitBranch.replace('refs/heads/', '');
  const dryRun = core.getBooleanInput('dry-run');
  // await git.fetch();

  conventionalRecommendedBump(
    {
      preset: 'angular',
    },
    async (err, reccomendation) => {
      if (err) {
        console.log('error reccommending bump', err);
        core.setFailed(err.message);
      }
      core.info(`Reccomended bump: ${reccomendation.releaseType}`);
      core.info(`Reason: ${reccomendation.reason}`);
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
      const releaseMessage = `chore: ${releaseTypeEmoji} ${releaseTypeLabelCapitalized} version ${OLD_VERSION} -> ${NEW_VERSION}`;

      core.info(`Old version: ${OLD_VERSION}`);
      core.info(`New version: ${NEW_VERSION}`);
      core.info(`Commit message: ${releaseMessage}`);

      // prepend version to release notes

      const shouldUpdateReleaseNotes = OLD_VERSION !== NEW_VERSION && releaseType !== 'patch';
      if (!shouldUpdateReleaseNotes) {
        core.info('No need to update release notes');
      }

      const releaseNotes = fs.readFileSync('./src/release.md', 'utf8');
      if (releaseNotes.startsWith(`#### v`) && shouldUpdateReleaseNotes) {
        const releaseNotesArray = releaseNotes.split('\n').filter(Boolean);
        const releaseNotesVersion = releaseNotesArray[0].replace('#### v', '');
        core.info(`Release notes already have version at start`);
        if (releaseNotesVersion.toString() === OLD_VERSION.toString()) {
          core.setFailed(
            `Release notes version matches old version, it looks like you haven't written new release notes for this feat: release`
          );
        }

        if (releaseNotesVersion.toString() !== NEW_VERSION.toString()) {
          core.setFailed(
            `Release notes version is not equal to new version 
            (i.e. i think it should be version: ${NEW_VERSION} but found : ${releaseNotesVersion} in the release notes). 
            Either updated release notes version to match new version 
            or remove version from release notes and this script will automagically add the correct one.`
          );
        }
      }
      if (!dryRun) {
        try {
          const copyPackageJson = { ...packageJson };
          copyPackageJson.version = NEW_VERSION;
          fs.writeFileSync('package.json', `${JSON.stringify(copyPackageJson, null, 2)}\n`);
          core.info(`Package.json version updated`);
          await exec('npm', ['install']);
          core.info(`NPM install ran`);
          if (shouldUpdateReleaseNotes) {
            const newReleaseNotes = `#### v${NEW_VERSION}\n\n\n${releaseNotes}`;
            fs.writeFileSync('./src/release.md', newReleaseNotes);
            core.info(`Release notes updated`);
          }
          await git.add('.');
          await git.commit(releaseMessage);
          await git.createTag(`v${NEW_VERSION}`);
          await git.push(gitBranch);
        } catch (e) {
          try {
            // try to revert changes if there was an error
            fs.writeFileSync('package.json', `${JSON.stringify(packageJson, null, 2)}\n`);
            await exec('npm', ['install']);

            core.info(`Reverted package.json version`);
            if (shouldUpdateReleaseNotes) {
              fs.writeFileSync('./src/release.md', releaseNotes);
              core.info(`Reverted release notes`);
            }

            core.setFailed(e);
          } catch (error) {
            // if there was an error reverting changes, exit
            core.info(`Error reverting changes`);
            core.setFailed(error);
          }
        }
      } else {
        core.info(`Dry run, not committing`);
      }
      core.setOutput('version', NEW_VERSION);
      core.setOutput('release-message', releaseMessage);
      core.setOutput('committed', !dryRun);
    }
  );
}

run().catch((e) => {
  core.setFailed(e);
});
