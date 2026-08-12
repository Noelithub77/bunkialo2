# Bunkialo

Bunkialo is an Expo React Native app for IIIT Kottayam students that aggregates Moodle attendance, assignment timeline, timetable, mess menu, and utility tools.

Bunkialo landing is the Next.js onboarding page for Bunkialo, in bunkialo-landing folder.

## License

This project is licensed under **GPL-3.0**.

meaning: if you fork and distribute a modified version, you must also provide source code for that modified version under GPL-compatible terms. Distributed derivatives cannot be closed source.

## Quick Start

### Prerequisites

- Bun
- Expo CLI / EAS CLI

### Install

```bash
bun install
```

### Environment

Copy `.env.example` into `.env`.

LMS test variables are optional and only needed if you run the test scripts:

- `LMS_TEST_USERNAME`
- `LMS_TEST_PASSWORD`

### Run

```bash
bunx expo start
```

### Android development build

The latest Android development build is available from the [EAS build page](https://expo.dev/accounts/ialexpo/projects/Bunkialo2/builds).
Download the APK, install it on an Android device, and use the EAS Update preview link from the matching pull request.

## Scripts

- `bun test` (unit tests against app modules)
- `bun run test:lms-scraper`
- `bun run test:dashboard`
- `bun run test:resources`
- `bun run test:downloads`
- `bun run test:assignment`
- `bun run test:assignment-submit` (uploads only with explicit `--submit`)
- `bun run test:e2e:assignment`
- `bun run test:e2e:feedback`

## Contributing

Please read [`.github/CONTRIBUTING.md`](.github/CONTRIBUTING.md) before opening pull requests.

## Security

Please report vulnerabilities through GitHub private vulnerability reporting. See [`.github/SECURITY.md`](.github/SECURITY.md).
