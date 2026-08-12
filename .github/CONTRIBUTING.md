# Contributing to Bunkialo

## Workflow

1. Fork the repo.
2. Create a branch from `main`.
3. Make focused changes.
4. Run checks locally.
5. Open a pull request.

## Development Setup

```bash
bun install
bunx expo start
```

## Android development build

Download the latest APK from the [Bunkialo2 EAS builds](https://expo.dev/accounts/ialexpo/projects/Bunkialo2/builds).
Use the development build for EAS Update previews; Expo Go cannot load updates that use a custom runtime version.

## Quality Checks

```bash
bunx tsc --noEmit
bun test
bun run test:lms-scraper
bun run test:assignment
bun run test:dashboard
bun run test:downloads
bun run test:resources
```

## Pull Request Rules

- Keep PRs small and focused.
- Include why the change is needed.
- Include test evidence in PR description.
- Do not commit credentials, tokens, or personal data.

## Coding Rules

- TypeScript strict mode.
- No `any`.
- Prefer NativeWind for styling.
- Keep services React-free.
