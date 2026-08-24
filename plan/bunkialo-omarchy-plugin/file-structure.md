# Adopted file structure

```text
bunkialo2/
  manifest.json
  omarchy-plugin/
    BarWidget.qml
    Service.qml
    BunkialoApi.js
    BunkialoCache.js
    BunkialoPanel.qml
    data/mess-menu.json
  shared/desktop.ts
  src/components/settings/desktop-plugin-section.tsx
  src/services/desktop-pairing.ts
  src/types/desktop.ts
  worker/desktop/timetable.ts
  scripts/export-omarchy-data.ts
  scripts/setup-omarchy.sh
  tests/unit/desktop-snapshot.test.ts

dotfiles/
  linux/hypr/.config/hypr/bindings.lua
  linux/omarchy/.config/omarchy/shell.json
  linux/omarchy/.config/omarchy/plugins/noel.bunkialo -> bunkialo2/omarchy-plugin
```
