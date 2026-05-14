const RELEASE_TYPES = ['major', 'minor', 'patch'];

const RELEASE_TYPE_LABELS = {
  major: 'Major',
  minor: 'Minor',
  patch: 'Patch',
};

const RELEASE_TYPE_EMOJIS = {
  major: '🚨',
  minor: '✨',
  patch: '🐛',
};

const OVERRIDE_LABELS = {
  'release:major': 'major',
  'release:minor': 'minor',
  'release:patch': 'patch',
};

function normalizeLabel(label) {
  return label.trim().toLowerCase();
}

function getLabelNamesFromPullRequest(pullRequest) {
  if (!pullRequest || !Array.isArray(pullRequest.labels)) {
    return [];
  }

  return pullRequest.labels
    .map((label) => (typeof label === 'string' ? label : label.name))
    .filter(Boolean);
}

function getReleaseOverride(labelNames) {
  const matchingLabels = labelNames
    .map(normalizeLabel)
    .filter((label) => Object.prototype.hasOwnProperty.call(OVERRIDE_LABELS, label));
  const uniqueLabels = [...new Set(matchingLabels)];

  if (uniqueLabels.length > 1) {
    throw new Error(`Conflicting release override labels found: ${uniqueLabels.join(', ')}`);
  }

  if (uniqueLabels.length === 0) {
    return null;
  }

  const label = uniqueLabels[0];
  return {
    label,
    releaseType: OVERRIDE_LABELS[label],
  };
}

function resolveReleaseType(recommendedReleaseType, labelNames = []) {
  const override = getReleaseOverride(labelNames);

  if (override) {
    return {
      releaseType: override.releaseType,
      source: 'label',
      label: override.label,
    };
  }

  if (RELEASE_TYPES.includes(recommendedReleaseType)) {
    return {
      releaseType: recommendedReleaseType,
      source: 'conventional',
    };
  }

  return {
    releaseType: 'patch',
    source: 'default',
  };
}

function incrementVersion(version, releaseType) {
  const parts = version.split('.').map((part) => parseInt(part, 10));

  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    throw new Error(`Invalid package version: ${version}`);
  }

  const [oldMajor, oldMinor, oldPatch] = parts;

  switch (releaseType) {
    case 'major':
      return `${oldMajor + 1}.0.0`;
    case 'minor':
      return `${oldMajor}.${oldMinor + 1}.0`;
    case 'patch':
      return `${oldMajor}.${oldMinor}.${oldPatch + 1}`;
    default:
      throw new Error(`Invalid release type: ${releaseType}`);
  }
}

function shouldUpdateReleaseNotes(releaseType) {
  return releaseType !== 'patch';
}

function validateReleaseNotes(releaseNotes, oldVersion, newVersion) {
  if (!releaseNotes.startsWith('#### v')) {
    return null;
  }

  const releaseNotesArray = releaseNotes.split('\n').filter(Boolean);
  const releaseNotesVersion = releaseNotesArray[0].replace('#### v', '');

  if (releaseNotesVersion.toString() === oldVersion.toString()) {
    return `Release notes version matches old version, it looks like you haven't written new release notes for this feat: release`;
  }

  if (releaseNotesVersion.toString() !== newVersion.toString()) {
    return `Release notes version is not equal to new version
            (i.e. i think it should be version: ${newVersion} but found : ${releaseNotesVersion} in the release notes).
            Either updated release notes version to match new version
            or remove version from release notes and this script will automagically add the correct one.`;
  }

  return null;
}

function formatReleaseMessage(releaseType, oldVersion, newVersion) {
  return `chore: ${RELEASE_TYPE_EMOJIS[releaseType]} ${RELEASE_TYPE_LABELS[releaseType]} version ${oldVersion} -> ${newVersion}`;
}

module.exports = {
  getLabelNamesFromPullRequest,
  getReleaseOverride,
  incrementVersion,
  resolveReleaseType,
  shouldUpdateReleaseNotes,
  validateReleaseNotes,
  formatReleaseMessage,
};
