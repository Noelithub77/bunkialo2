# Bunkialo

Bunkialo is an Expo React Native app for IIIT Kottayam students that aggregates Moodle attendance, assignment timeline, timetable, mess menu, and utility tools.

## License

This project is licensed under **GPL-3.0**.

Simple meaning: if you fork and distribute a modified version, you must also provide source code for that modified version under GPL-compatible terms. Distributed derivatives cannot be closed source.

## Quick Start

### Prerequisites
- Bun
- Node.js 20+
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

## Scripts

- `node src/scripts/test-scraper.mjs`
- `node src/scripts/test-dashboard.mjs`
- `node src/scripts/test-timetable-logic.mjs`

## Contributing

Please read `CONTRIBUTING.md` before opening pull requests.

## Security

Please report vulnerabilities through GitHub private vulnerability reporting. See `SECURITY.md`.
