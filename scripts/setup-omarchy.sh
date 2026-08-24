#!/usr/bin/env bash
set -euo pipefail

plugin_id="noel.bunkialo"
script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
repo_root="$(cd -- "$script_dir/.." && pwd -P)"
plugin_source="${1:-$repo_root}"
config_root="${XDG_CONFIG_HOME:-${HOME:?HOME is required}/.config}"
bindings_path="$config_root/hypr/bindings.lua"
installed_plugin="$config_root/omarchy/plugins/$plugin_id"

command -v omarchy >/dev/null || { echo "omarchy is required" >&2; exit 1; }
command -v omarchy-plugin-validate >/dev/null || {
  echo "omarchy-plugin-validate is required" >&2
  exit 1
}

[[ -f "$plugin_source/manifest.json" ]] || {
  echo "Bunkialo plugin source is missing manifest.json: $plugin_source" >&2
  exit 1
}
[[ "$(jq -r '.id // empty' "$plugin_source/manifest.json")" == "$plugin_id" ]] || {
  echo "Unexpected plugin id in $plugin_source/manifest.json" >&2
  exit 1
}

plugin_is_valid=0
if [[ -d "$installed_plugin" ]] && omarchy-plugin-validate "$installed_plugin" >/dev/null; then
  plugin_is_valid=1
fi

if (( plugin_is_valid )); then
  omarchy plugin enable "$plugin_id"
else
  # Remove a stale catalog entry or dangling symlink before reinstalling.
  if [[ -e "$installed_plugin" || -L "$installed_plugin" ]]; then
    omarchy plugin remove "$plugin_id" --yes
  fi
  omarchy plugin add "$plugin_source" --enable --yes
fi

omarchy-shell shell rescanPlugins >/dev/null
omarchy-plugin-validate "$installed_plugin" >/dev/null
omarchy plugin enable "$plugin_id" >/dev/null

mkdir -p "$(dirname -- "$bindings_path")"
if [[ ! -f "$bindings_path" ]] \
  || ! grep -Fq 'shell toggle noel.bunkialo' "$bindings_path" \
  || ! grep -Fq 'noel.bunkialo showWifix' "$bindings_path"; then
  {
    printf '\n-- Bunkialo plugin integration\n'
    printf 'hl.unbind("SUPER + B")\n'
    printf 'o.bind("SUPER + B", "Bunkialo", "omarchy-shell shell toggle noel.bunkialo")\n'
    printf 'hl.unbind("SUPER + SHIFT + B")\n'
    printf 'o.bind("SUPER + SHIFT + B", "WiFix", "sh -c '\''quickshell ipc -p /usr/share/omarchy/shell -n call noel.bunkialo showWifix; omarchy-shell shell toggle noel.bunkialo'\''")\n'
  } >> "$bindings_path"
  echo "Added Bunkialo keybindings to $bindings_path"
else
  echo "Bunkialo keybindings already exist in $bindings_path"
fi

if command -v hyprctl >/dev/null; then
  hyprctl reload >/dev/null
  config_errors="$(hyprctl configerrors)"
  if [[ -n "$config_errors" ]]; then
    printf '%s\n' "$config_errors" >&2
    exit 1
  fi
fi

echo "Bunkialo Omarchy integration is ready"
