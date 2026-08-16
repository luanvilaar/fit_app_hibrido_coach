---
name: git-push-requires-agent-env
description: In fit2, git push / gh pr create / gh pr merge are denied unless the command declares AIOX_ACTIVE_AGENT=devops inline
metadata:
  type: project
---

`git push`, `gh pr create` and `gh pr merge` are blocked in this repo by a Claude Code
PreToolUse hook at `.claude/hooks/enforce-git-push-authority.cjs`. A bare `git push -f origin main`
fails with: `git push is exclusive to @devops (Constitution Article II). Current agent: @unknown.`

The hook reads the agent from env vars (`AIOX_ACTIVE_AGENT`, `AIOX_AGENT`, `ACTIVE_AGENT`,
`CLAUDE_AGENT_NAME`, `CLAUDE_CODE_AGENT`, `AIOX_CURRENT_AGENT`) **or** from an inline assignment
parsed straight out of the command string. Since the Bash tool does not persist shell state between
calls, the inline form is the one that works:

```
AIOX_ACTIVE_AGENT=devops git push -f origin main
```

Accepted aliases: `devops`, `@devops`, `github-devops`, `@github-devops`, `aiox-devops`, `@aiox-devops`.

**Why:** Constitution Article II makes remote publication exclusive to @devops. The inline env
declaration is the sanctioned identity mechanism — it is not a bypass. Do NOT reach for
`--no-verify` or try to disable the hook; that would be circumventing the gate rather than
satisfying it.

**How to apply:** Prefix every remote git/gh command with `AIOX_ACTIVE_AGENT=devops` from the
first attempt, when operating as @devops. Saves a guaranteed failed round trip.

Related: [[selective-staging-shared-manifests]]
