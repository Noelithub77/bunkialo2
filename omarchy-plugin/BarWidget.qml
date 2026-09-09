import QtQuick
import Quickshell
import qs.Ui
import qs.Commons

BarWidget {
  id: root

  moduleName: "noel.bunkialo"

  readonly property var bunkialoService: bar && bar.shell
    && typeof bar.shell.serviceFor === "function"
    ? bar.shell.serviceFor("noel.bunkialo") : null
  readonly property var glance: bunkialoService ? bunkialoService.glance : ({})
  readonly property bool stale: bunkialoService ? bunkialoService.stale : false
  readonly property bool loading: bunkialoService ? bunkialoService.loading : false
  readonly property color iconColor: Color.accent
  readonly property bool opened: panelLoader.item ? panelLoader.item.opened === true : false
  readonly property bool popoutSwitchClosing: panelLoader.item
    ? panelLoader.item.popoutSwitchClosing === true : false

  function togglePanel() {
    if (panelLoader.item) panelLoader.item.toggle()
  }

  function open() { if (panelLoader.item) panelLoader.item.open() }
  function close() { if (panelLoader.item) panelLoader.item.close() }
  function toggle() { root.togglePanel() }
  function closeForPopoutSwitch() {
    if (panelLoader.item && typeof panelLoader.item.closeForPopoutSwitch === "function")
      panelLoader.item.closeForPopoutSwitch()
  }

  function injectPanel() {
    if (!panelLoader.item) return
    panelLoader.item.bar = root.bar
    panelLoader.item.anchorItem = button
    panelLoader.item.hostWidget = root
  }

  implicitWidth: button.implicitWidth
  implicitHeight: button.implicitHeight

  Loader {
    id: panelLoader
    active: true
    source: Qt.resolvedUrl("BunkialoPanel.qml")
    visible: false
    onLoaded: {
      root.injectPanel()
      Qt.callLater(root.injectPanel)
    }
  }

  onBarChanged: root.injectPanel()

  WidgetButton {
    id: button
    anchors.fill: parent
    bar: root.bar
    text: "B"
    foreground: root.iconColor
    activeColor: root.iconColor
    fontSize: Style.font.subtitle
    labelVisible: true
    hasVisualContent: true
    active: true
    useActiveColor: false
    horizontalMargin: 8.75
    verticalPadding: 8.75
    tooltipText: root.loading ? "Bunkialo · Refreshing" : root.stale
      ? "Bunkialo · Offline · Cached" : "Bunkialo · Super+B for full view"
    onPressed: function(buttonId) {
      if (buttonId === Qt.MiddleButton && root.bunkialoService)
        root.bunkialoService.refresh()
      else if (buttonId === Qt.LeftButton)
        root.togglePanel()
    }
  }
}
