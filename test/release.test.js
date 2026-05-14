const assert = require('node:assert/strict');
const test = require('node:test');
const {
  getLabelNamesFromPullRequest,
  incrementVersion,
  resolveReleaseType,
  shouldUpdateReleaseNotes,
  validateReleaseNotes,
  formatReleaseMessage,
} = require('../helpers/release');

test('release label overrides conventional recommendation', () => {
  assert.deepEqual(resolveReleaseType('minor', ['release:patch']), {
    releaseType: 'patch',
    source: 'label',
    label: 'release:patch',
  });
});

test('conventional recommendation is used when no override label exists', () => {
  assert.deepEqual(resolveReleaseType('minor', ['bug']), {
    releaseType: 'minor',
    source: 'conventional',
  });
});

test('missing recommendation defaults to patch', () => {
  assert.deepEqual(resolveReleaseType(undefined, []), {
    releaseType: 'patch',
    source: 'default',
  });
});

test('conflicting release labels fail clearly', () => {
  assert.throws(
    () => resolveReleaseType('patch', ['release:minor', 'release:patch']),
    /Conflicting release override labels/
  );
});

test('pull request label names are read from payload labels', () => {
  assert.deepEqual(
    getLabelNamesFromPullRequest({
      labels: [{ name: 'release:patch' }, { name: 'bug' }, 'docs'],
    }),
    ['release:patch', 'bug', 'docs']
  );
});

test('versions are incremented by selected release type', () => {
  assert.equal(incrementVersion('1.2.3', 'major'), '2.0.0');
  assert.equal(incrementVersion('1.2.3', 'minor'), '1.3.0');
  assert.equal(incrementVersion('1.2.3', 'patch'), '1.2.4');
});

test('only major and minor releases require release notes', () => {
  assert.equal(shouldUpdateReleaseNotes('major'), true);
  assert.equal(shouldUpdateReleaseNotes('minor'), true);
  assert.equal(shouldUpdateReleaseNotes('patch'), false);
});

test('release note validation accepts unversioned notes or matching new version', () => {
  assert.equal(validateReleaseNotes('Some release notes', '1.2.3', '1.3.0'), null);
  assert.equal(validateReleaseNotes('#### v1.3.0\n\nSome release notes', '1.2.3', '1.3.0'), null);
});

test('release note validation rejects old or mismatched version headings', () => {
  assert.match(validateReleaseNotes('#### v1.2.3\n\nSome release notes', '1.2.3', '1.3.0'), /old version/);
  assert.match(
    validateReleaseNotes('#### v1.4.0\n\nSome release notes', '1.2.3', '1.3.0'),
    /not equal to new version/
  );
});

test('release message matches existing action format', () => {
  assert.equal(formatReleaseMessage('patch', '1.2.3', '1.2.4'), 'chore: 🐛 Patch version 1.2.3 -> 1.2.4');
});
