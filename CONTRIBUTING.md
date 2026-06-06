# Contributing to SyncSpace

First off, thank you for considering contributing to SyncSpace! We welcome all contributions, from bug reports to feature requests and code submissions.

## Branch Naming Conventions
To keep our repository organized, please follow these branch naming conventions:
- **Features:** `feature/<feature-name>` (e.g., `feature/ai-standups`)
- **Bug Fixes:** `bugfix/<bug-name>` (e.g., `bugfix/socket-memory-leak`)
- **Hotfixes:** `hotfix/<issue>` (e.g., `hotfix/prod-auth-crash`)

## Commit Conventions
We strictly follow the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) specification. This allows us to auto-generate changelogs and maintain a readable history.

Format: `<type>(<optional scope>): <description>`

Examples:
- `feat: add optimistic UI to task drag-and-drop`
- `fix(auth): resolve token refresh loop on 401`
- `docs: update api environment variables`
- `refactor(ai): extract json parsing logic into utility`
- `test: add integration coverage for workspaces`

## Pull Request Process
1. Fork the repository and create your branch from `main`.
2. Ensure you have installed all dependencies and verified your changes locally.
3. Run `npm run lint` and verify there are **0 warnings and 0 errors**.
4. Run `npm test` and ensure all tests pass.
5. Push your branch and open a Pull Request against `main`.
6. Your PR must pass the automated GitHub Actions CI pipeline.
7. Wait for code review. At least one approval is required before your code can be merged.
