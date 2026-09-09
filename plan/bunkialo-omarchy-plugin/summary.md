# Bunkialo Omarchy Plugin

The Worker exposes a token-authenticated desktop snapshot. The web Settings
screen creates and revokes the token, while the Omarchy plugin stores it in
Secret Service and caches the snapshot until Refresh is pressed.

The Omarchy plugin is published from this repository. Its root manifest points
to the files in `omarchy-plugin/`, while the dotfiles plugin path is only a
local development link.

The plugin shows current and next classes in the bar, opens with `SUPER+B`,
shows horizontal timetable and mess pages, sends class and newly fetched inbox
alerts, and keeps the mess JSON generated from `src/data/mess.ts`.
