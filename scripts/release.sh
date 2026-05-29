#!/usr/bin/env bash
set -euo pipefail

DRY_RUN=false

for arg in "$@"; do
  case "$arg" in
    --dry-run)
      DRY_RUN=true
      ;;
    -h | --help)
      echo "Usage: npm run release [-- --dry-run]"
      echo ""
      echo "Runs tests, creates an annotated tag matching package.json version"
      echo "(e.g. 0.1.12 — no v prefix), and pushes the current branch and tag to origin."
      echo ""
      echo "Bump first: npm run version:patch|minor|major"
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      exit 1
      ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="$(node -p "require('./package.json').version")"
TAG="${VERSION}"
BRANCH="$(git branch --show-current)"

if [[ -z "$BRANCH" ]]; then
  echo "Detached HEAD; checkout a branch before releasing." >&2
  exit 1
fi

LATEST_ORIGIN_TAG="$(
  git ls-remote --tags origin \
    | awk '{print $2}' \
    | sed 's|refs/tags/||' \
    | grep -v '\^{}$' \
    | sort -V \
    | tail -1
)"

echo "Preparing release tag ${TAG} from branch ${BRANCH}"
if [[ -n "$LATEST_ORIGIN_TAG" ]]; then
  echo "Latest tag on origin: ${LATEST_ORIGIN_TAG}"
fi

if [[ "$TAG" == "$LATEST_ORIGIN_TAG" ]]; then
  echo "Bump version in package.json before releasing (still ${TAG})." >&2
  exit 1
fi

npm test

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean. Commit or stash changes before releasing." >&2
  git status --short
  exit 1
fi

if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Tag ${TAG} already exists locally." >&2
  exit 1
fi

if git ls-remote --exit-code --tags origin "refs/tags/${TAG}" >/dev/null 2>&1; then
  echo "Tag ${TAG} already exists on origin." >&2
  exit 1
fi

if [[ "$DRY_RUN" == true ]]; then
  echo "Dry run — would run:"
  echo "  git tag -a ${TAG} -m ${TAG}"
  echo "  git push origin ${BRANCH}"
  echo "  git push origin ${TAG}"
  exit 0
fi

git tag -a "$TAG" -m "$TAG"
git push origin "$BRANCH"
git push origin "$TAG"

echo "Released ${TAG} (${BRANCH} pushed to origin)"
