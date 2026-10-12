# Repository delivery rules

For every completed app change made by Codex in this repository:

1. Verify the change with the relevant type checks, tests, and build checks.
2. Commit all finished source changes before handing the task back to the user.
3. Push the commit to the matching GitHub branch so the completed work is backed up remotely.
4. Report the branch and commit in the final response.

Do not commit secrets, local environment files, dependency folders, generated build
outputs, APK-analysis files, crash dumps, or other temporary artifacts. Do not push
unfinished or failing work merely to make the working tree clean. If verification or
the push is blocked, preserve the work locally and clearly report the blocker.

Follow an explicit user instruction not to commit or push when one is given for a
particular task.
