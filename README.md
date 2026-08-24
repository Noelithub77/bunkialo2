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

Download the latest Android development APK from the [GitHub Releases page](https://github.com/Noelithub77/bunkialo2/releases), install it on an Android device, and use the EAS Update preview link from the matching pull request.

## Omarchy plugin

On Omarchy, install Bunkialo and configure its shortcuts with one command:

```bash
git clone https://github.com/Noelithub77/bunkialo2.git
cd bunkialo2
./scripts/setup-omarchy.sh
```

This installs/enables the plugin, adds `SUPER+B` to open it and
`SUPER+SHIFT+B` to expand it, reloads Hyprland, and checks for config errors.
The command is safe to run again. For plugin-only installation, see
[`omarchy-plugin/README.md`](omarchy-plugin/README.md).

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
