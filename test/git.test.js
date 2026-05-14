const assert = require('node:assert/strict');
const test = require('node:test');

process.env.ENV = 'dont-use-git';
process.env['INPUT_GIT-USER-NAME'] = 'MyDianomi Bot';
process.env['INPUT_GIT-USER-EMAIL'] = 'myDianomi@example.com';
process.env['INPUT_GIT-URL'] = 'github.com';
process.env['INPUT_GITHUB-TOKEN'] = '';

const git = require('../helpers/git');

test('commit messages are passed as a single git argument', async () => {
  const capturedArgs = [];
  const originalExec = git.exec;
  git.exec = async (args) => {
    capturedArgs.push(args);
    return '';
  };

  try {
    await git.commit('chore: "quoted" version 1.2.3 -> 1.2.4');

    assert.deepEqual(capturedArgs[0], [
      'commit',
      '-m',
      'chore: "quoted" version 1.2.3 -> 1.2.4',
    ]);
  } finally {
    git.exec = originalExec;
  }
});

test('annotated tags are created with argument arrays', async () => {
  const capturedArgs = [];
  const originalExec = git.exec;
  git.exec = async (args) => {
    capturedArgs.push(args);
    return '';
  };

  try {
    await git.createTag('v1.2.4');

    assert.deepEqual(capturedArgs[0], ['tag', '-a', 'v1.2.4', '-m', 'v1.2.4']);
  } finally {
    git.exec = originalExec;
  }
});
