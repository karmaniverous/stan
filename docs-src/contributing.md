---
title: Contributing — Dev Quickstart
---

# Contributing — Dev Quickstart

Thanks for helping improve STAN! This project follows a services‑first, test‑first philosophy. Here’s how to get started locally.

## Setup

Prereqs:
- Node ≥ 20
- Git

Clone and install:
```bash
git clone https://github.com/karmaniverous/stan.git
cd stan
npm i
```

## Common tasks

Run the suite:
```bash
npm run lint
npm run typecheck
npm run test
npm run build
npm run docs
```

Or watch continuously:
```bash
npm run bootstrap
```

## Coding standards

- Single‑Responsibility modules; prefer small, testable units.
- Plain unified diffs for patches; never base64.
- Keep `.stan/system/stan.todo.md` updated with each change set and include a commit message (fenced) in PRs.

## Submitting changes

1. Create a feature branch: `git checkout -b feature/your-change`.
2. Ensure CI tasks pass locally.
3. Open a PR with a clear description and links to any related issues.
4. Expect review on tests, docs updates, and module design.

## Questions?

Open a GitHub issue with details or propose a design sketch in the PR description.
