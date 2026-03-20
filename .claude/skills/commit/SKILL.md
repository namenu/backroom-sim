---
description: "Lint, test, commit, and push in one step. Use instead of manual git commit/push."
user_invocable: true
---

# /commit

Lint → test → pull → commit → push. Never skip a step. If any step fails, fix before proceeding.

## Steps

1. **Type check**: Run `npm run build`. If errors, fix them before continuing.
2. **Test**: Run `npm test`. If failures, fix them before continuing.
3. **Pull**: Run `git pull --rebase origin main`. If conflicts, resolve before continuing.
4. **Stage**: Stage only relevant changed files by name. Never `git add -A`. Never commit `.env` or credentials.
5. **Commit**: Write a conventional commit message (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`). Keep it concise (1-2 lines). Append `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`.
6. **Push**: Run `git push`.

## Rules

- If type check or tests fail, fix the issue and re-run from step 1. Do not skip ahead.
- Maximum 3 fix iterations. If still failing after 3 attempts, stop and report what's broken.
- Never use `--no-verify`, `--force`, or `--amend` unless the user explicitly requests it.
- Always create a NEW commit, never amend the previous one.
