# Bunkialo Omarchy plugin

## Install

Install and enable only the plugin with Omarchy's plugin CLI:

```bash
omarchy plugin add https://github.com/Noelithub77/bunkialo2.git --enable --yes
```

The plugin CLI does not modify Hyprland keybindings. To install the plugin,
add the Bunkialo shortcuts, reload Hyprland, and validate the configuration in
one command, run:

```bash
curl -fsSL https://raw.githubusercontent.com/Noelithub77/bunkialo2/main/scripts/setup-omarchy.sh | bash
```

The script is idempotent. It can also be run from a local clone:

```bash
git clone https://github.com/Noelithub77/bunkialo2.git
cd bunkialo2
./scripts/setup-omarchy.sh
```

The plugin uses the production Bunkialo desktop API. Open the Bunkialo
credentials page, copy the one-line two-entry JSON, and save it in the plugin
settings. The plugin keeps it in Secret Service and sends that JSON as the
desktop request credential; it does not depend on a time-limited desktop
pairing record. WiFix uses the first entry locally; connecting to WiFi does not
contact Bunkialo. Refreshing timetable or notifications still uses the
production API.

WiFix only handles the campus SSIDs `IIITKottayam` and `IIITKottayam_5G`.
It reads the already-connected WiFi device (without triggering a WiFi scan),
A cached campus SSID result is used immediately as a hint, then validated with
a live no-captive-portal HTTP `204` check when the panel opens. Refresh also
forces a new check.
A `204` means internet is available and shows Logout; an intercepted response
shows Connect. The probe and portal requests are bound to the active campus
WiFi interface, so WARP cannot make a captive connection look online. The
portal hostname is resolved through that interface's DHCP DNS at runtime; the
returned address is used only for that request and is never hardcoded. Login
fetches `/login?...`, extracts its `magic` and `4Tredir` fields, and posts
those values with the credentials. Logout only calls the portal logout URL; it
never disconnects a NetworkManager device, so it cannot bring down Tailscale.

Run the real local round-trip test while connected to campus WiFi:

```bash
bun run test:wifix:atomic
```

It logs each request's exit code, HTTP status, gateway, response size, and
sanitized curl error, then verifies WiFi connectivity and that Tailscale's
interface state did not change.

## Keybindings

The normal Omarchy plugin installer does not change Hyprland configuration.
If you do not use `scripts/setup-omarchy.sh`, add these to
`~/.config/hypr/bindings.lua`:

```lua
o.bind("SUPER + B", "Bunkialo", "omarchy-shell shell toggle noel.bunkialo")
hl.unbind("SUPER + SHIFT + B")
o.bind("SUPER + SHIFT + B", "WiFix", "sh -c 'quickshell ipc -p /usr/share/omarchy/shell -n call noel.bunkialo showWifix; omarchy-shell shell toggle noel.bunkialo'")
```
