/* eslint-disable import/no-extraneous-dependencies */
const core = require('@actions/core');
const exec = require('@actions/exec');

const { GITHUB_REPOSITORY, ENV } = process.env;

module.exports = new (class Git {
  commandsRun = [];

  constructor() {
    try {

      const githubToken = core.getInput('github-token');
      
      // Make the Github token secret
      core.setSecret(githubToken);
      
      const gitUserName = core.getInput('git-user-name');
      const gitUserEmail = core.getInput('git-user-email');
      const gitUrl = core.getInput('git-url');
      
      // if the env is dont-use-git then we mock exec as we are testing a workflow
      if (ENV === 'dont-use-git') {
        this.exec = (command) => {
          const fullCommand = `git ${command}`;
          
          // eslint-disable-next-line no-console
          console.log(`Skipping "${fullCommand}" because of test env`);
          
          if (!fullCommand.includes('git remote set-url origin')) {
            this.commandsRun.push(fullCommand);
          }
        };
      }
      
      // Set config
      this.config('user.name', gitUserName);
      this.config('user.email', gitUserEmail);
      
      // Update the origin
      // if (githubToken) {
      //   this.updateOrigin(`https://x-access-token:${githubToken}@${gitUrl}/${GITHUB_REPOSITORY}.git`);
      // }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      core.setFailed(e.message);
    }
  }

  /**
   * Executes the git command
   *
   * @param command
   * @return {Promise<>}
   */
  // eslint-disable-next-line class-methods-use-this, no-async-promise-executor
  exec = (command) =>
    // eslint-disable-next-line no-async-promise-executor
    new Promise(async (resolve, reject) => {
      let execOutput = '';

      const options = {
        listeners: {
          stdout: (data) => {
            execOutput += data.toString();
          },
        },
      };

      const exitCode = await exec.exec(`git ${command}`, null, options);

      if (exitCode === 0) {
        resolve(execOutput);
      } else {
        // eslint-disable-next-line prefer-promise-reject-errors
        reject(`Command "git ${command}" exited with code ${exitCode}.`);
      }
    });

  /**
   * Set a git config prop
   *
   * @param prop
   * @param value
   * @return {Promise<>}
   */
  config = (prop, value) => this.exec(`config ${prop} "${value}"`);

  /**
   * Switch to (and create if not already exists) branch
   * 
   * @param  branchName 
   * @return {Promise<>}
   */
  switch = (branchName) => this.exec(`switch ${branchName}`)

  /**
   * Add a file to commit
   *
   * @param file
   * @returns {*}
   */
  add = (file) => this.exec(`add ${file}`);

  /**
   * Commit all changes
   *
   * @param message
   *
   * @return {Promise<>}
   */
  commit = (message) => this.exec(`commit -m "${message}"`);

  /**
   * Pull the full history
   *
   * @return {Promise<>}
   */
  pull = async () => {
    const args = ['pull'];

    // Check if the repo is unshallow
    if (await this.isShallow()) {
      args.push('--unshallow');
    }

    args.push('--tags');
    args.push(core.getInput('git-pull-method'));

    return this.exec(args.join(' '));
  };

  /**
   * Push all changes
   *
   * @return {Promise<>}
   */
  push = (branch) => this.exec(`push origin ${branch} --follow-tags`);

  /**
   * Check if the repo is shallow
   *
   * @return {Promise<>}
   */
  isShallow = async () => {
    if (ENV === 'dont-use-git') {
      return false;
    }

    const isShallow = await this.exec('rev-parse --is-shallow-repository');

    return isShallow.trim().replace('\n', '') === 'true';
  };

  /**
   * Updates the origin remote
   *
   * @param repo
   * @return {Promise<>}
   */
  updateOrigin = (repo) => this.exec(`remote set-url origin ${repo}`);

  /**
   * Creates git tag
   *
   * @param tag
   * @return {Promise<>}
   */
  createTag = (tag) => this.exec(`tag -a ${tag} -m "${tag}"`);

  /**
   * Validates the commands run
   */
})();
