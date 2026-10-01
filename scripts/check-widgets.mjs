import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import vm from "node:vm";

// Run the same serialized layouts and interaction runtime shipped in native widgets.
const root = process.cwd();
const output = fs.mkdtempSync(path.join(os.tmpdir(), "bunkialo-widget-check-"));
let checks = 0;
const card = (id, day, startMinute, name) => ({
  id,
  day,
  startMinute,
  endMinute: startMinute + 60,
  name,
  time: "9am–10am",
  color: "#A78BFA",
  lightBackground: "#f0eafb",
  darkBackground: "#342d45",
  items: [],
});
const classes = {
  cards: [
    card("1", 4, 540, "Algorithms"),
    card("2", 4, 630, "Physics"),
    card("3", 5, 540, "Design"),
  ],
  page: 0,
  anchor: 0,
  utcOffsetMinutes: 330,
};
const nodes = (tree) => [
  tree,
  ...[tree?.props?.children]
    .flat(Infinity)
    .filter((child) => child && typeof child === "object")
    .flatMap(nodes),
];
const texts = (tree) =>
  nodes(tree)
    .filter((node) => node.type === "TextView")
    .map((node) => node.props.text);

try {
  for (const platform of ["android", "ios"]) {
    const bundle = path.join(output, `${platform}.bundle`);
    const registryFile = path.join(output, `${platform}.json`);
    for (const [script, file] of [
      ["build-bundle.mjs", bundle],
      ["build-layout-registry.mjs", registryFile],
    ]) {
      execFileSync(
        process.execPath,
        [
          path.join(root, "node_modules/expo-widgets/scripts", script),
          root,
          platform,
          file,
        ],
        { stdio: "inherit" },
      );
    }
    let timestamp = Date.parse("2026-10-01T03:45:00Z");
    class WidgetDate extends Date {
      static now() {
        return timestamp;
      }
    }
    const context = vm.createContext({ console, Date: WidgetDate });
    vm.runInContext(fs.readFileSync(bundle, "utf8"), context);
    const registry = JSON.parse(fs.readFileSync(registryFile, "utf8")).widgets;
    const environment = (
      colorScheme = "light",
      widgetFamily = "systemSmall",
    ) => ({
      colorScheme,
      widgetFamily,
      ...(platform === "ios" ? { timestamp } : {}),
    });
    const render = (props, scheme = "light", family = "systemSmall") =>
      context.__expoWidgetRender(props, environment(scheme, family));
    const click = (props, direction) => {
      const buttons = nodes(render(props)).filter((node) => node.props?.target);
      assert.equal(buttons.length, 2);
      return context.__expoWidgetHandlePress(props, {
        ...environment(),
        target: buttons[direction].props.target,
      });
    };
    const load = (name) => {
      context.__expoWidgetLayout = vm.runInContext(
        `(${registry[name].layout})`,
        context,
      );
    };
    load("BunkialoTimetable");
    assert.ok(
      texts(render(registry.BunkialoTimetable.initialProps)).includes(
        "No classes",
      ),
    );
    checks++;
    assert.ok(texts(render(classes)).includes("Now"));
    checks++;
    assert.ok(texts(render(classes)).includes("Algorithms"));
    checks++;
    const next = click(classes, 1);
    assert.equal(next.page, 1);
    assert.ok(texts(render(next)).includes("Physics"));
    checks++;
    assert.ok(texts(render(click(classes, 0))).includes("Design"));
    checks++;
    assert.notEqual(
      JSON.stringify(render(classes)),
      JSON.stringify(render(classes, "dark")),
    );
    checks++;
    timestamp = Date.parse("2026-10-01T04:31:00Z");
    const moved = texts(render(next));
    assert.ok(moved.includes("Physics") && moved.includes("Next"));
    checks++;
    timestamp = Date.parse("2026-10-01T15:31:00Z");
    const tomorrow = texts(render(classes));
    assert.equal(tomorrow.filter((text) => text === "Tomorrow").length, 1);
    checks++;

    load("BunkialoMess");
    const meals = registry.BunkialoMess.initialProps;
    timestamp = Date.parse("2026-10-01T03:00:00Z");
    const breakfast = texts(render(meals));
    assert.ok(breakfast.includes("Now") && breakfast.includes("Breakfast"));
    checks++;
    assert.ok(breakfast.some((text) => text.startsWith("• ")));
    checks++;
    assert.ok(texts(render(click(meals, 1))).includes("Lunch"));
    checks++;
    timestamp = Date.parse("2026-10-01T04:15:00Z");
    const lunch = texts(render(meals));
    assert.ok(lunch.includes("Lunch") && lunch.includes("Next"));
    checks++;
    timestamp = Date.parse("2026-10-01T15:30:00Z");
    assert.ok(texts(render(meals)).includes("Tomorrow"));
    checks++;
    if (platform === "android") {
      const allowed = new Set([
        "ColumnView",
        "RowView",
        "TextView",
        "SpacerView",
        "TextButton",
      ]);
      assert.ok(nodes(render(meals)).every((node) => allowed.has(node.type)));
      checks++;
    } else {
      assert.ok(
        texts(render(meals, "light", "systemMedium")).filter((text) =>
          text.startsWith("• "),
        ).length >= 5,
      );
      checks++;
    }
    console.log(`${platform}: widget rendering and paging passed`);
  }
  console.log(`${checks} native widget checks passed`);
} finally {
  fs.rmSync(output, { recursive: true, force: true });
}
