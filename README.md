# VS Code Customization Migration Test

This repository is a ready-to-use fixture for testing VS Code's Agent Host customization migration hint.

## Included Customizations

The repository contains five workspace customization files that should be offered for migration:

- Two prompt files in `.github/prompts`
- One agent in the configured `.custom/agents` location
- One instruction file in the configured `.custom/instructions` location
- One skill in the configured `.custom/skills` location

All required experimental settings and custom locations are committed in `.vscode/settings.json`.

## Test

1. Open this repository as a folder in the VS Code build under test.
2. Start a new Copilot CLI or Claude Agent Host chat session.
3. Send any request.
4. Verify that the response includes a hint similar to:

   `Found 5 workspace customizations that are present but not used by <harness> and could be migrated.`

5. Select **Review customizations**.
6. Verify that **Agent Customizations** opens on the first applicable migration page and that keyboard focus moves to its first actionable control.

See [microsoft/vscode#334500](https://github.com/microsoft/vscode/issues/334500) for the complete test plan.

## Dismissal

Do not select **Hide for this workspace** until dismissal behavior is being tested. The dismissal is stored for the workspace and harness, and currently has no reset action in the UI.
