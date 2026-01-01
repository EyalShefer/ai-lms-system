# Project Brain Guardian: System Documentation

## Module Overview
**Module Name**: Project Brain Guardian
**Module ID**: module_project_brain_guardian
**Maintainer**: System Documentation Architect (AI Agent)
**Status**: Active

## Description
The **Project Brain Guardian** is a system automation tool designed to bridge the gap between codebase changes and the project's persistent knowledge base in Google Drive. It ensures that technical documentation and the central `project_data` registry are always in sync with the latest code state.

## Core Capabilities
1.  **Registry Management**: Automatically updates `project_data.json` with version bumps, timestamps, and change summaries.
2.  **Cloud Sync**: Encrypted, authenticated backup of documentation and registry files to a designated Google Drive folder using a Service Account.
3.  **Local Mirroring**: Maintains a local `project_brain_backup` directory for redundancy.

## Architecture
- **Trigger**: Currently manual invocation (CLI) or AI Agent triggered. Future: Watcher/Git Hook.
- **Authentication**: Uses Google Cloud Service Account (`service-account-key.json`).
- **Configuration**: Uses `.env` for sensitve IDs (`GDRIVE_BACKUP_FOLDER_ID`).

## Usage
\`\`\`bash
npx ts-node scripts/project_brain_guardian.ts "<ModuleName>" "<ChangeSummary>" "<PathToFile>"
\`\`\`

## Change Log
- **2026-01-01**: Initial release. Implemented registry logic and Google Drive V3 API integration.
