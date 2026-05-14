/* eslint-disable no-console */
/* eslint-disable import/no-extraneous-dependencies */
const core = require('@actions/core');
const fs = require('fs');
const conventionalRecommendedBump = require('conventional-recommended-bump');
const github = require('@actions/github');
const git = require('./helpers/git');
const exec = require('@actions/exec');
const {
  getLabelNamesFromPullRequest,
  incrementVersion,
  resolveReleaseType,
  shouldUpdateReleaseNotes,
  validateReleaseNotes,
  formatReleaseMessage,
} = require('./helpers/release');

function getRecommendedBump() {
  return new Promise((resolve, reject) => {
    conventionalRecommendedBump(
      {
        preset: 'angular',
      },
      (err, recommendation) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(recommendation || {});
      }
    );
  });
}

async function getPullRequestLabelNames() {
  const pullRequest = github.context.payload.pull_request;

  if (pullRequest) {
    return getLabelNamesFromPullRequest(pullRequest);
  }

  const githubToken = core.getInput('github-token');
  if (!githubToken || !github.context.sha) {
    return [];
  }

  try {
    const octokit = github.getOctokit(githubToken);
    const { owner, repo } = github.context.repo;
    const pullRequestsResponse = await octokit.rest.repos.listPullRequestsAssociatedWithCommit({
      owner,
      repo,
      commit_sha: github.context.sha,
    });
    const pullRequestForCommit =
      pullRequestsResponse.data.find((associatedPullRequest) => associatedPullRequest.merged_at) ||
      pullRequestsResponse.data[0];

    if (!pullRequestForCommit) {
      return [];
    }

    const labelsResponse = await octokit.rest.issues.listLabelsOnIssue({
      owner,
      repo,
      issue_number: pullRequestForCommit.number,
    });

    return labelsResponse.data.map((label) => label.name).filter(Boolean);
  } catch (error) {
    core.warning(`Could not load pull request labels from GitHub API: ${error.message}`);
    return [];
  }
}

async function run() {
  let gitBranch = core.getInput('git-branch');
  // console.log(await git.exec(`rev-parse --abbrev-ref HEAD`));
  gitBranch = gitBranch.replace('refs/heads/', '');
  const dryRun = core.getBooleanInput('dry-run');
  // await git.fetch();

  const recommendation = await getRecommendedBump();
  core.info(`Recommended bump: ${recommendation.releaseType || 'patch'}`);
  core.info(`Reason: ${recommendation.reason || 'No conventional bump found; using patch'}`);

  const labelNames = await getPullRequestLabelNames();
  core.info(`Pull request labels: ${labelNames.length ? labelNames.join(', ') : 'none'}`);

  const releaseDecision = resolveReleaseType(recommendation.releaseType, labelNames);
  const { releaseType } = releaseDecision;

  if (releaseDecision.source === 'label') {
    core.info(`Release override label found: ${releaseDecision.label}`);
  }

  if (releaseDecision.source === 'default') {
    core.info('No conventional bump found; defaulting to patch');
  }

  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const OLD_VERSION = packageJson.version;
  const NEW_VERSION = incrementVersion(OLD_VERSION, releaseType);
  const releaseMessage = formatReleaseMessage(releaseType, OLD_VERSION, NEW_VERSION);

  core.info(`Selected bump: ${releaseType}`);
  core.info(`Old version: ${OLD_VERSION}`);
  core.info(`New version: ${NEW_VERSION}`);
  core.info(`Commit message: ${releaseMessage}`);

  const updateReleaseNotes = shouldUpdateReleaseNotes(releaseType);
  let shouldPrependReleaseNotesVersion = false;
  let releaseNotes = null;
  if (updateReleaseNotes) {
    releaseNotes = fs.readFileSync('./src/release.md', 'utf8');
    const releaseNotesError = validateReleaseNotes(releaseNotes, OLD_VERSION, NEW_VERSION);

    if (releaseNotesError) {
      throw new Error(releaseNotesError);
    }

    shouldPrependReleaseNotesVersion = !releaseNotes.startsWith(`#### v${NEW_VERSION}`);
  } else {
    core.info('No need to update release notes');
  }

  if (!dryRun) {
    try {
      const copyPackageJson = { ...packageJson };
      copyPackageJson.version = NEW_VERSION;
      fs.writeFileSync('package.json', `${JSON.stringify(copyPackageJson, null, 2)}\n`);
      core.info(`Package.json version updated`);
      await exec('npm', ['install']);
      core.info(`NPM install ran`);
      if (shouldPrependReleaseNotesVersion) {
        const newReleaseNotes = `#### v${NEW_VERSION}\n\n\n${releaseNotes}`;
        fs.writeFileSync('./src/release.md', newReleaseNotes);
        core.info(`Release notes updated`);
      } else if (updateReleaseNotes) {
        core.info(`Release notes already include version`);
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
        if (shouldPrependReleaseNotesVersion) {
          fs.writeFileSync('./src/release.md', releaseNotes);
          core.info(`Reverted release notes`);
        }
      } catch (error) {
        // if there was an error reverting changes, exit
        core.info(`Error reverting changes`);
        throw error;
      }

      throw e;
    }
  } else {
    core.info(`Dry run, not committing`);
  }

  core.setOutput('version', NEW_VERSION);
  core.setOutput('release-message', releaseMessage);
  core.setOutput('committed', !dryRun);
}

run().catch((e) => {
  core.setFailed(e.message || e);
});
