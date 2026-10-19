---
name: deploy-is-manual
description: The user pushes and deploys themselves; Claude leaves everything ready
metadata:
  type: feedback
---

Never run `git push` or a deploy command in this project. Commit locally, then tell the user the change is ready.

**Why:** a push here triggers a production deploy for a client, and the user wants to check it first.
**How to apply:** end the task with "ready to push" plus the commit list. See [[client-dashboard-stack]].
