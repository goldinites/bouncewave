---
name: release
description: Ship a new BounceWave version to GitHub Pages — version bump through a pull request, then a vX.Y.Z tag that triggers the deploy, then watching the run and checking the site. Use when the user asks for a release, a new version or a deploy (e.g. "сделаем релиз", "выкатывай").
---

# Release

Deploys run only from a pushed `v*` tag (`.github/workflows/deploy.yml`), and the tag must equal
`package.json`'s version or the run fails on purpose. Pushing to `main` deploys nothing.

## 1. Prepare

- `git fetch origin --tags`; `main` must equal `origin/main` with a clean tree.
- List what changed since the last tag: `git log --no-merges --format='%h %s' <last-tag>..origin/main`.
- Propose the version by semver (new features → minor, fixes only → patch, breaking saves or
  controls → major) and confirm it with the user: the tag publishes to every player.

## 2. Version bump through a pull request

```sh
git switch -c release/vX.Y.Z
npm version X.Y.Z --no-git-tag-version   # package.json and package-lock.json
npm test
git commit -am "Release X.Y.Z"           # body: a short player-facing summary since the last release
git push -u origin release/vX.Y.Z
```

Give the user the PR link (`https://github.com/goldinites/bouncewave/pull/new/release/vX.Y.Z`)
and a description listing the changes. Wait until they say it is merged.

## 3. Tag

```sh
git fetch origin --tags && git switch main && git merge --ff-only origin/main
node -p "require('./package.json').version"   # must print X.Y.Z
git tag -a vX.Y.Z <merge-commit> -m "BounceWave X.Y.Z"
git push origin vX.Y.Z
```

## 4. Watch the deploy

`gh` is not installed; the repository is public, so the API answers without a token:

```sh
curl -s "https://api.github.com/repos/goldinites/bouncewave/actions/runs?branch=vX.Y.Z&per_page=1"
curl -s "https://api.github.com/repos/goldinites/bouncewave/actions/runs/<id>/jobs"
```

Poll in a background command until the run is `completed`, then report each job's conclusion and
any failed step. If `deploy` is rejected by the environment, the `github-pages` environment needs
a rule allowing `v*` tags (Settings → Environments).

## 5. Check the site

`curl -s https://goldinites.github.io/bouncewave/` answers 200 and references a new
`assets/index-*.js`. Mention that an installed PWA picks the update up on its next launch, and
offer a GitHub Release page for the tag (the user creates it; it does not affect the deploy).
