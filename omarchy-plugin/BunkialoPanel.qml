import QtQuick
import QtQuick.Layouts
import QtQuick.Controls
import Quickshell
import qs.Commons
import qs.Ui
import "BunkialoApi.js" as Api
Panel {
  id: root
  moduleName: "noel.bunkialo"
  manageIpc: false
  property var anchorItem: null
  property var hostWidget: null
  property bool settingsOpen: false
  property bool inboxOpen: false
  readonly property var service: hostWidget ? hostWidget.bunkialoService : null
  readonly property var barIdentity: hostWidget || root
  readonly property color foreground: bar ? bar.barForeground : Color.foreground
  readonly property string fontFamily: bar ? bar.fontFamily : Style.font.family
  readonly property var timetableGroups: service ? Api.groupByDay(service.snapshot.timetable) : []
  readonly property var mealDays: service ? service.messMenu : []
  readonly property var todayClasses: service
    ? (timetableGroups[service.now.getDay()] || { slots: [] }).slots : []
  readonly property var todayMeals: service
    ? Api.mealForDay(service.messMenu, service.now.getDay()).meals : []
  readonly property var snapshot: service ? service.snapshot : ({ timetable: [], notifications: [] })
  readonly property bool timetableExpanded: service ? service.timetableExpanded : false
  readonly property bool menuExpanded: service ? service.menuExpanded : false
  function open() { root.controller.show() }
  function close() {
    root.settingsOpen = false
    root.inboxOpen = false
    if (root.service) root.service.wifixMode = false
    root.controller.hide()
  }
  function toggle() { root.opened ? root.close() : root.open() }
  function toggleInbox() {
    root.inboxOpen = !root.inboxOpen
    if (root.inboxOpen) {
      root.settingsOpen = false
      if (root.service) root.service.markInboxSeen()
    }
  }
  function movePage(list, event) {
    var delta = event.angleDelta.x !== 0 ? event.angleDelta.x : event.angleDelta.y
    if (delta === 0 || list.count < 2) return
    var direction = delta < 0 ? 1 : -1
    root.moveCarousel(list, direction)
    event.accepted = true
  }
  function moveCarousel(list, direction) {
    if (!list || list.count < 2) return
    list.currentIndex = Math.max(0, Math.min(list.count - 1, list.currentIndex + direction))
  }
  function classFocusIndex() {
    var target = root.service ? (root.service.glance.currentClass || root.service.glance.nextClass) : null
    if (!target) return 0
    for (var index = 0; index < root.todayClasses.length; index += 1) {
      if (root.todayClasses[index] === target
        || String(root.todayClasses[index].id || "") === String(target.id || "")) return index
    }
    return 0
  }
  function mealFocusIndex() {
    var target = root.service ? root.service.mealGlance.center : null
    if (!target) return 0
    for (var index = 0; index < root.todayMeals.length; index += 1) {
      if (root.todayMeals[index] === target) return index
    }
    return 0
  }
  function switchPanel(direction) { return root.bar && typeof root.bar.switchPanelFrom === "function" ? root.bar.switchPanelFrom(root.barIdentity, direction) : false }
  function openUrl(url) { var value = String(url || ""); if (value.charAt(0) === "/") value = "https://bunkialo.noelmcv7.workers.dev" + value; if (/^https?:\/\//.test(value)) Quickshell.execDetached(["xdg-open", value]) }
  onOpenedChanged: if (opened) Qt.callLater(function() {
    classCarousel.currentIndex = root.classFocusIndex()
    mealCarousel.currentIndex = root.mealFocusIndex()
  })
  KeyboardPanel {
    id: panel
    anchorItem: root.anchorItem
    owner: root.barIdentity
    bar: root.bar
    open: root.opened
    focusTarget: keyCatcher
    contentWidth: panel.fittedContentWidth(Style.space(520))
    contentHeight: panel.fittedContentHeight(contentColumn.implicitHeight)
      PanelKeyCatcher {
      id: keyCatcher
      anchors.fill: parent
      onCloseRequested: root.close()
      onTabRequested: function(direction) { root.switchPanel(direction) }
      onMoveRequested: function(dx, dy) {
        if (dx !== 0) {
          root.moveCarousel(classCarousel, dx)
          root.moveCarousel(mealCarousel, dx)
          return
        }
        if (!root.service) return
        var expanded = root.timetableExpanded && root.menuExpanded
        if ((dy > 0 && !expanded) || (dy < 0 && expanded)) root.service.toggleExpanded()
      }
      Rectangle {
        anchors.fill: parent
        anchors.margins: Style.space(2)
        color: "#000000"
        radius: Style.cornerRadius
        z: 0
      }
      Flickable {
        id: verticalScroll
        anchors.fill: parent
        anchors.margins: Style.space(7)
        contentWidth: width
        contentHeight: contentColumn.implicitHeight + Style.space(4)
        clip: true
        z: 1
        boundsBehavior: Flickable.StopAtBounds
        interactive: contentHeight > height
        Column {
          id: contentColumn
          width: verticalScroll.width
          spacing: Style.space(10)
          RowLayout {
            width: parent.width
            spacing: Style.space(7)
            Text {
              text: "BUNKIALO"
              color: root.foreground
              font.family: root.fontFamily
              font.pixelSize: Style.font.subtitle
              font.bold: true
              Layout.fillWidth: true
            }
            Rectangle {
              width: Style.space(7)
              height: width
              radius: width / 2
              color: root.service && root.service.stale ? Color.urgent
                : root.service && root.service.loading ? Color.accent
                : Color.accent
            }
            Text {
              text: root.service && root.service.loading ? "..."
                : root.service ? Api.formatUpdated(root.service.lastRefreshAt, root.service.now) : ""
              color: root.service && root.service.stale ? Color.urgent : Qt.darker(root.foreground, 1.35)
              font.family: root.fontFamily
              font.pixelSize: Style.font.caption
            }
            PanelActionButton {
              iconText: root.settingsOpen || root.inboxOpen || (root.service && root.service.wifixMode) ? "" : ""
              tooltipText: root.settingsOpen || root.inboxOpen || (root.service && root.service.wifixMode) ? "Back" : "Settings"
              foreground: root.foreground
              onClicked: {
                if (root.settingsOpen || root.inboxOpen || (root.service && root.service.wifixMode)) {
                  root.settingsOpen = false
                  root.inboxOpen = false
                  if (root.service) root.service.wifixMode = false
                } else {
                  root.settingsOpen = true
                }
              }
            }
            Item {
              implicitWidth: inboxButton.implicitWidth
              implicitHeight: inboxButton.implicitHeight
              PanelActionButton {
                id: inboxButton
                iconText: ""
                tooltipText: "Inbox"
                foreground: root.foreground
                onClicked: {
                  root.toggleInbox()
                }
              }
              Rectangle {
                visible: !!root.service && root.service.unreadCount > 0
                anchors.right: parent.right
                anchors.top: parent.top
                width: Style.space(18)
                height: Style.space(14)
                radius: width / 2
                color: Color.urgent
                Text {
                  anchors.centerIn: parent
                  text: root.service && root.service.unreadCount > 9 ? "9+" : String(root.service ? root.service.unreadCount : "")
                  color: Color.background
                  font.family: root.fontFamily
                  font.pixelSize: Style.font.caption
                  font.bold: true
                }
              }
            }
            PanelActionButton {
              iconText: ""
              tooltipText: "Refresh"
              foreground: root.foreground
              enabled: !!root.service && !root.service.loading
              onClicked: if (root.service) root.service.refresh()
            }
          }
          Item {
            id: glancePage
            visible: !root.settingsOpen && !root.inboxOpen && (!root.service || !root.service.wifixMode)
            width: parent.width
            height: visible ? glanceColumn.implicitHeight : 0
            Column {
              id: glanceColumn
              width: parent.width
              spacing: Style.space(10)
          ListView {
            id: classCarousel
            width: parent.width
            height: Style.space(68)
            clip: true
            orientation: ListView.Horizontal
            model: root.todayClasses.length > 0 ? root.todayClasses : [null]
            property real cardWidth: Math.max(170, width * 0.56)
            currentIndex: root.classFocusIndex()
            onVisibleChanged: if (visible) currentIndex = root.classFocusIndex()
            snapMode: ListView.SnapToItem
            highlightRangeMode: ListView.StrictlyEnforceRange
            preferredHighlightBegin: (width - cardWidth) / 2
            preferredHighlightEnd: (width + cardWidth) / 2
            highlightMoveDuration: 120
            boundsBehavior: Flickable.StopAtBounds
            flickDeceleration: 6500
            maximumFlickVelocity: 8000
            pressDelay: 0
            WheelHandler {
              onWheel: function(event) { root.movePage(classCarousel, event) }
            }
            spacing: Style.space(7)
            delegate: GlanceCard {
              required property int index
              required property var modelData
              width: classCarousel.cardWidth
              property var classData: modelData
              property bool isCurrent: !!classData && !!root.service && !!root.service.glance.currentClass
                && (classData === root.service.glance.currentClass
                  || String(classData.id || "") === String(root.service.glance.currentClass.id || ""))
              property bool isNext: !!classData && !!root.service && !!root.service.glance.nextClass
                && (classData === root.service.glance.nextClass
                  || String(classData.id || "") === String(root.service.glance.nextClass.id || ""))
              tag: !classData ? "NOW" : isCurrent ? "NOW" : isNext ? "NEXT" : "CLASS"
              value: classData ? classData.courseName : "Free"
              detail: classData ? Api.formatTime(classData.startTime) + "–" + Api.formatTime(classData.endTime) : ""
              accent: classData ? Api.courseColor(classData.courseId) : Color.accent
              foreground: root.foreground; fontFamily: root.fontFamily
            }
          }
          ListView {
            id: mealCarousel
            width: parent.width
            height: Style.space(136)
            clip: true
            orientation: ListView.Horizontal
            model: root.todayMeals.length > 0 ? root.todayMeals : [null]
            property real cardWidth: Math.max(240, width * 0.56)
            currentIndex: root.mealFocusIndex()
            onVisibleChanged: if (visible) currentIndex = root.mealFocusIndex()
            snapMode: ListView.SnapToItem
            highlightRangeMode: ListView.StrictlyEnforceRange
            preferredHighlightBegin: (width - cardWidth) / 2
            preferredHighlightEnd: (width + cardWidth) / 2
            highlightMoveDuration: 120
            boundsBehavior: Flickable.StopAtBounds
            flickDeceleration: 6500
            maximumFlickVelocity: 8000
            pressDelay: 0
            WheelHandler {
              onWheel: function(event) { root.movePage(mealCarousel, event) }
            }
            spacing: Style.space(7)
            delegate: MealGlanceCard {
              required property int index
              required property var modelData
              width: mealCarousel.cardWidth
              property var mealData: modelData
              property bool isCenter: !!mealData && !!root.service && mealData === root.service.mealGlance.center
              property bool isNext: !!mealData && !!root.service && mealData === root.service.mealGlance.next
              tag: !mealData ? "MEAL" : isCenter
                ? (root.service.mealGlance.centerIsCurrent ? "CURRENT MEAL" : "NEXT MEAL")
                : isNext ? "UP NEXT" : "MEAL"
              meal: mealData
              emptyLabel: "None"
              foreground: root.foreground; fontFamily: root.fontFamily
            }
          }
          RowLayout {
            width: parent.width
            spacing: Style.space(4)
            SectionTitle { text: root.timetableExpanded && root.menuExpanded ? "COLLAPSE" : "EXPAND"; foreground: root.foreground; fontFamily: root.fontFamily }
            Item { Layout.fillWidth: true }
            PanelActionButton {
              iconText: root.timetableExpanded && root.menuExpanded ? "▴" : "▾"
              tooltipText: root.timetableExpanded && root.menuExpanded ? "Collapse full view" : "Expand full view"
              foreground: root.foreground
              onClicked: if (root.service) root.service.toggleExpanded()
            }
          }
          ListView {
            id: timetableScroll
            width: parent.width
            height: root.timetableExpanded
              ? Math.min(236, Math.max(116, root.timetableGroups.length > 0 ? 188 : 116)) : 0
            visible: root.timetableExpanded
            clip: true
            orientation: ListView.Horizontal
            model: root.timetableGroups
            currentIndex: root.service ? root.service.now.getDay() : new Date().getDay()
            snapMode: ListView.SnapToItem
            highlightRangeMode: ListView.StrictlyEnforceRange
            preferredHighlightBegin: 0
            preferredHighlightEnd: width
            highlightMoveDuration: 120
            boundsBehavior: Flickable.StopAtBounds
            interactive: count > 1
            flickDeceleration: 6500
            maximumFlickVelocity: 8000
            pressDelay: 0
            WheelHandler {
              onWheel: function(event) { root.movePage(timetableScroll, event) }
            }
            delegate: DayPage {
              required property var modelData
              width: timetableScroll.width
              height: timetableScroll.height
              heading: modelData.shortName
              foreground: root.foreground; fontFamily: root.fontFamily
              rows: modelData.slots
              }
          }
          ListView {
            id: messScroll
            width: parent.width
            height: root.menuExpanded ? 330 : 0
            visible: root.menuExpanded
            clip: true
            orientation: ListView.Horizontal
            model: root.mealDays
            currentIndex: root.service ? root.service.now.getDay() : new Date().getDay()
            snapMode: ListView.SnapToItem
            highlightRangeMode: ListView.StrictlyEnforceRange
            preferredHighlightBegin: 0
            preferredHighlightEnd: width
            highlightMoveDuration: 120
            boundsBehavior: Flickable.StopAtBounds
            interactive: count > 1
            flickDeceleration: 6500
            maximumFlickVelocity: 8000
            pressDelay: 0
            WheelHandler {
              onWheel: function(event) { root.movePage(messScroll, event) }
            }
            delegate: MealPage {
              required property var modelData
              width: messScroll.width
              height: messScroll.height
              heading: Api.dayShortName(modelData.day)
              foreground: root.foreground; fontFamily: root.fontFamily
              meals: modelData.meals
            }
          }
        }
      }
      Item {
        visible: root.inboxOpen && (!root.service || !root.service.wifixMode)
        width: parent.width
        height: visible ? inboxColumn.implicitHeight : 0
        Column {
          id: inboxColumn
          width: parent.width
          spacing: Style.space(8)
          SectionTitle { text: "INBOX"; foreground: Color.accent; fontFamily: root.fontFamily }
          Column {
            width: parent.width
            spacing: Style.space(5)
            Repeater {
              model: root.snapshot.notifications
              delegate: NotificationCard {
                required property var modelData
                notification: modelData
                onOpenRequested: function(url) { root.openUrl(url) }
              }
            }
            Text {
              visible: root.snapshot.notifications.length === 0
              text: "No notifications"
              color: Qt.darker(root.foreground, 1.4)
              font.family: root.fontFamily
              font.pixelSize: Style.font.bodySmall
            }
          }
        }
      }
      Item {
        visible: root.settingsOpen || (root.service && root.service.wifixMode)
        width: parent.width
        height: visible ? settingsColumn.implicitHeight : 0
        Column {
          id: settingsColumn
          width: parent.width
          spacing: Style.space(12)
          SectionTitle { visible: !root.service || !root.service.wifixMode; text: "ACCOUNT"; foreground: Color.accent; fontFamily: root.fontFamily }
          Text {
            visible: (!root.service || !root.service.paired) && (!root.service || !root.service.wifixMode)
            text: "Save the shared credentials JSON once"
            color: root.foreground
            font.family: root.fontFamily
            font.pixelSize: Style.font.bodySmall
          }
          PanelActionButton {
            visible: (!root.service || !root.service.paired) && (!root.service || !root.service.wifixMode)
            iconText: "↗"
            tooltipText: "Open Bunkialo credentials page"
            foreground: Color.accent
            onClicked: root.openUrl("/pair/desktop")
          }
          RowLayout {
            visible: (!root.service || !root.service.paired) && (!root.service || !root.service.wifixMode)
            width: parent.width
            spacing: Style.space(6)
            TextField {
              id: settingsToken
              Layout.fillWidth: true
              placeholderText: "Paste credentials JSON"
              color: root.foreground
              foreground: root.foreground
              accent: Color.accent
              font.family: "monospace"
              font.pixelSize: Style.font.caption
              selectByMouse: true
              password: true
              height: Style.space(34)
            }
            Button {
              text: "Pair"
              selected: true
              accent: Color.accent
              fontFamily: root.fontFamily
              onClicked: if (root.service && root.service.saveToken(settingsToken.text)) settingsToken.text = ""
            }
          }
          SectionTitle {
            visible: !!root.service && root.service.wifixMode && (root.service.wifixAvailable || root.service.wifixChecking)
            text: "WIFIX"
            foreground: Color.accent
            fontFamily: root.fontFamily
          }
          Column {
            visible: !!root.service && root.service.wifixMode && (root.service.wifixAvailable || root.service.wifixChecking)
            width: parent.width
            spacing: Style.space(6)
            Text {
              text: root.service && root.service.currentSsid
                ? root.service.currentSsid : "Checking this WiFi"
              color: Qt.darker(root.foreground, 1.2)
              font.family: root.fontFamily
              font.pixelSize: Style.font.caption
              elide: Text.ElideRight
              width: parent.width
            }
            Column {
              width: parent.width
              spacing: Style.space(8)
              Button {
                visible: !!root.service && !root.service.wifixConnected
                width: parent.width
                height: Style.space(48)
                text: root.service && root.service.wifixChecking
                  ? "Checking campus portal..." : "Connect to campus WiFi"
                selected: true
                accent: Color.accent
                fontFamily: root.fontFamily
                onClicked: if (root.service) root.service.startWifixConnect()
              }
              Button {
                visible: !!root.service && root.service.wifixConnected
                width: parent.width
                height: Style.space(48)
                text: "Disconnect from campus WiFi"
                bordered: true
                foreground: Color.urgent
                fontFamily: root.fontFamily
                onClicked: if (root.service) root.service.logoutWifix()
              }
              Text {
                visible: !!root.service && root.service.wifixMessage !== ""
                text: root.service ? root.service.wifixMessage : ""
                color: root.service && root.service.wifixConnected
                  ? Color.accent : Qt.darker(root.foreground, 1.2)
                font.family: root.fontFamily
                font.pixelSize: Style.font.caption
                elide: Text.ElideRight
                width: parent.width
              }
            }
          }
          SectionTitle { visible: !root.service || !root.service.wifixMode; text: "CLASS ALERT"; foreground: Color.accent; fontFamily: root.fontFamily }
          RowLayout {
            visible: !root.service || !root.service.wifixMode
            width: parent.width
            spacing: Style.space(5)
            Repeater {
              model: [0, 5, 10, 15, 30]
              Button {
                required property int modelData
                text: modelData + "m"
                selected: root.service && root.service.leadMinutes === modelData
                bordered: !selected
                fontFamily: root.fontFamily
                fontSize: Style.font.caption
                horizontalPadding: Style.space(7)
                onClicked: if (root.service) root.service.setLeadMinutes(modelData)
              }
            }
          }
          Button {
            visible: !!root.service && root.service.paired && !root.service.wifixMode
            text: "Unpair desktop"
            bordered: true
            foreground: Color.urgent
            fontFamily: root.fontFamily
            onClicked: if (root.service) root.service.clearToken()
          }
        }
      }
    }
  }
  }
  }
  component SectionTitle: Text {
    property color foreground: Color.foreground
    property string fontFamily: Style.font.family
    color: Qt.darker(foreground, 1.35)
    font.family: fontFamily
    font.pixelSize: Style.font.caption
    font.bold: true
    font.letterSpacing: 1.1
  }
  component GlanceCard: BorderSurface {
    property string tag: ""; property string value: ""; property string detail: ""
    property color accent: Color.accent; property color foreground: Color.foreground
    property string fontFamily: Style.font.family
    implicitHeight: 62; radius: Style.cornerRadius
    color: Style.normalFillFor(foreground, accent); borderSpec: Border.controlSpec("normal", foreground, accent)
    Rectangle {
      width: Style.space(4); height: parent.height; color: parent.accent; radius: Style.cornerRadius
    }
    Column {
      anchors.fill: parent; anchors.leftMargin: Style.space(11); anchors.rightMargin: Style.space(7)
      anchors.topMargin: Style.space(7); anchors.bottomMargin: Style.space(6)
      spacing: Style.space(1)
      Text {
        text: parent.parent.tag
        color: parent.parent.accent
        font.family: parent.parent.fontFamily
        font.pixelSize: Style.font.caption
        font.bold: true
      }
      Text {
        width: parent.width
        text: parent.parent.value
        color: parent.parent.foreground
        font.family: parent.parent.fontFamily
        font.pixelSize: Style.font.bodySmall
        font.bold: true
        elide: Text.ElideRight
      }
      Text {
        text: parent.parent.detail
        color: Qt.darker(parent.parent.foreground, 1.25)
        font.family: parent.parent.fontFamily
        font.pixelSize: Style.font.caption
      }
    }
  }
  component MealGlanceCard: BorderSurface {
    property string tag: "NEXT MEAL"
    property string emptyLabel: "Done"
    property var meal: null
    readonly property string itemText: meal && meal.items ? String(meal.items.join(" · ")) : ""
    property color foreground: Color.foreground
    property string fontFamily: Style.font.family
    readonly property color accent: meal ? Api.mealColor(meal.type) : Color.accent
    implicitHeight: mealColumn.implicitHeight + Style.space(16)
    radius: Style.cornerRadius
    color: Style.normalFillFor(foreground, accent)
    borderSpec: Border.controlSpec("normal", foreground, accent)
    Rectangle {
      width: Style.space(4); height: parent.height; color: parent.accent; radius: Style.cornerRadius
    }
    Column {
      id: mealColumn
      anchors.left: parent.left; anchors.right: parent.right
      anchors.top: parent.top; anchors.margins: Style.space(9)
      anchors.leftMargin: Style.space(11); anchors.rightMargin: Style.space(8)
      spacing: Style.space(2)
      Text {
        text: parent.parent.tag
        color: parent.parent.accent
        font.family: parent.parent.fontFamily
        font.pixelSize: Style.font.caption
        font.bold: true
      }
      RowLayout {
        width: parent.width
        spacing: Style.space(6)
        Text {
          text: parent.parent.parent.meal ? parent.parent.parent.meal.name : parent.parent.parent.emptyLabel
          color: parent.parent.parent.foreground
          font.family: parent.parent.parent.fontFamily
          font.pixelSize: Style.font.bodySmall
          font.bold: true
          Layout.fillWidth: true
        }
        Text {
          text: parent.parent.parent.meal
            ? parent.parent.parent.meal.startTime + "–" + parent.parent.parent.meal.endTime : ""
          color: Qt.darker(parent.parent.parent.foreground, 1.25)
          font.family: parent.parent.parent.fontFamily
          font.pixelSize: Style.font.caption
        }
      }
      Text {
        width: parent.width
        text: parent.parent.itemText
        color: Qt.darker(parent.parent.foreground, 1.05)
        font.family: parent.parent.fontFamily
        font.pixelSize: Style.font.caption
        wrapMode: Text.Wrap
        visible: text.length > 0
      }
    }
  }
  component DayPage: BorderSurface {
    property string heading: ""; property var rows: []
    property color foreground: Color.foreground; property string fontFamily: Style.font.family
    radius: Style.cornerRadius; color: Style.normalFillFor(foreground, Color.accent)
    borderSpec: Border.controlSpec("normal", foreground, Color.accent)
    Column {
      anchors.fill: parent; anchors.margins: Style.space(9); spacing: Style.space(5)
      Text {
        text: parent.parent.heading; color: parent.parent.foreground; font.family: parent.parent.fontFamily
        font.pixelSize: Style.font.body; font.bold: true
      }
      Repeater {
        model: parent.parent.rows
        delegate: Rectangle {
          required property var modelData
          width: parent.width; height: Style.space(27); radius: Style.cornerRadius
          color: Style.normalFillFor(root.foreground, Api.courseColor(modelData.courseId))
          Rectangle {
            width: Style.space(3); height: parent.height; color: Api.courseColor(modelData.courseId); radius: Style.cornerRadius
          }
          RowLayout {
            anchors.fill: parent; anchors.leftMargin: Style.space(8); anchors.rightMargin: Style.space(6)
            spacing: Style.space(5)
            Text {
              text: Api.formatTime(modelData.startTime); color: root.foreground; font.family: root.fontFamily
              font.pixelSize: Style.font.caption
              Layout.preferredWidth: Style.space(58)
            }
            Text {
              text: modelData.courseName; color: root.foreground; font.family: root.fontFamily
              font.pixelSize: Style.font.bodySmall; font.bold: true; elide: Text.ElideRight; Layout.fillWidth: true
            }
          }
        }
      }
      Text {
        visible: parent.parent.rows.length === 0; text: "Free"; color: Qt.darker(parent.parent.foreground, 1.35)
        font.family: parent.parent.fontFamily; font.pixelSize: Style.font.bodySmall
      }
    }
  }
  component MealPage: BorderSurface {
    property string heading: ""; property var meals: []
    property color foreground: Color.foreground; property string fontFamily: Style.font.family
    radius: Style.cornerRadius; color: Style.normalFillFor(foreground, Color.accent)
    borderSpec: Border.controlSpec("normal", foreground, Color.accent)
    Column {
      anchors.fill: parent; anchors.margins: Style.space(9); spacing: Style.space(5)
      Text {
        text: parent.parent.heading; color: parent.parent.foreground; font.family: parent.parent.fontFamily
        font.pixelSize: Style.font.body; font.bold: true
      }
      Repeater {
        model: parent.parent.meals
        delegate: Rectangle {
          required property var modelData
          width: parent.width; height: Style.space(70); radius: Style.cornerRadius
          color: Style.normalFillFor(root.foreground, Api.mealColor(modelData.type))
          Rectangle {
            width: Style.space(3); height: parent.height; color: Api.mealColor(modelData.type); radius: Style.cornerRadius
          }
          Column {
            anchors.fill: parent; anchors.leftMargin: Style.space(8); anchors.rightMargin: Style.space(6)
            anchors.topMargin: Style.space(4); anchors.bottomMargin: Style.space(4); spacing: Style.space(1)
            RowLayout {
              width: parent.width
              Text {
                text: modelData.name; color: root.foreground; font.family: root.fontFamily
                font.pixelSize: Style.font.bodySmall; font.bold: true; elide: Text.ElideRight; Layout.fillWidth: true
              }
              Text {
                text: modelData.startTime + "–" + modelData.endTime; color: root.foreground
                font.family: root.fontFamily; font.pixelSize: Style.font.caption
              }
            }
            Text {
              width: parent.width; text: modelData.items.join(" · "); color: Qt.darker(root.foreground, 1.2)
              font.family: root.fontFamily; font.pixelSize: Style.font.caption; wrapMode: Text.WordWrap
            }
          }
        }
      }
      Text {
        visible: parent.parent.meals.length === 0; text: "No menu"; color: Qt.darker(parent.parent.foreground, 1.35)
        font.family: parent.parent.fontFamily; font.pixelSize: Style.font.bodySmall
      }
    }
  }
}
