---
name: selective-staging-shared-manifests
description: How to commit only your own dependency changes when package.json/package-lock.json mix two parallel workstreams
metadata:
  type: feedback
---

When staging selectively (never `git add -A`), shared manifest files are the hard case:
`package.json` and `package-lock.json` can contain dependency additions from *another* in-flight
workstream, and `git add <file>` is all-or-nothing.

Working technique (does not touch the working tree, so the other workstream keeps its changes):

1. Read the working-tree file, strip only the foreign entries (in `package-lock.json` that means
   both the line under `packages[""].dependencies` and the whole `node_modules/<pkg>` block),
   write the result to the scratchpad. Assert removal counts and `JSON.parse` the result so a bad
   edit fails loudly instead of silently producing an invalid manifest.
2. `git hash-object -w <scratchpad-file>` to get a blob sha.
3. `git update-index --cacheinfo 100644,<sha>,<path>` to stage that exact content.
4. Verify with `git diff --cached -- <paths>` before committing; `git status` should show `MM`
   (staged subset + remaining unstaged foreign changes).

**Why:** Alan's rule is to stage selectively by category, never `git add -A`. Committing a foreign
dependency alongside your own work couples two unrelated workstreams and can leave `main` with a
dependency for code that is not committed yet. Interactive `git add -p` is unavailable in this
environment, so the index must be written directly.

**How to apply:** Any time `package.json` / `package-lock.json` / other shared manifests are dirty
and only part of the diff belongs to the change you are committing. Before doing it, confirm whose
change is whose — grep the repo for the dependency and check `git show HEAD:<file>` to see whether
the consuming code is already committed.

Related: [[git-push-requires-agent-env]]
