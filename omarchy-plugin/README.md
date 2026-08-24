# Bunkialo Omarchy plugin

To install the plugin and configure `SUPER+B` and `SUPER+SHIFT+B` together,
clone Bunkialo and run the setup command:

```bash
git clone https://github.com/Noelithub77/bunkialo2.git
cd bunkialo2
./scripts/setup-omarchy.sh
```

The setup command is explicit and idempotent. It installs/enables the plugin,
adds the keybindings once, reloads Hyprland, and checks for config errors.

To install only the plugin from Git:

```bash
omarchy plugin add https://github.com/Noelithub77/bunkialo2.git --enable
```

The plugin uses the production Bunkialo desktop API. Open the Bunkialo
credentials page, copy the one-line two-entry JSON, and save it in the plugin
settings. The plugin keeps it in Secret Service and WiFix uses the first entry
locally; connecting to WiFi does not contact Bunkialo. Refreshing timetable or
notifications still uses the production API.

The plugin checks whether
`auth.iiitkottayam.ac.in` resolves on the current WiFi SSID, caches that result
per SSID until Refresh, and only then shows Connect or Logout.

## Keybindings

The normal Omarchy plugin installer does not change Hyprland configuration.
If you do not use `scripts/setup-omarchy.sh`, add these to
`~/.config/hypr/bindings.lua`:

```lua
o.bind("SUPER + B", "Bunkialo", "omarchy-shell shell toggle noel.bunkialo")
hl.unbind("SUPER + SHIFT + B")
o.bind("SUPER + SHIFT + B", "WiFix", "sh -c 'quickshell ipc -p /usr/share/omarchy/shell -n call noel.bunkialo showWifix; omarchy-shell shell toggle noel.bunkialo'")
```
