import QtQuick
import qs.Commons

Rectangle {
  id: card

  property var notification: ({})
  signal openRequested(string url)

  width: parent ? parent.width : 0
  height: notificationText.implicitHeight + Style.space(10)
  radius: Style.cornerRadius
  color: Style.normalFillFor(Color.foreground, card.notification.unread ? Color.accent : Color.foreground)
  border.width: card.notification.unread ? 2 : 0
  border.color: Color.accent

  Text {
    id: notificationText
    anchors.fill: parent
    anchors.margins: Style.space(6)
    text: (card.notification.unread ? "●  " : "")
      + String(card.notification.title || "Notification")
      + (card.notification.body ? "\n" + String(card.notification.body) : "")
    color: Color.foreground
    font.family: Style.font.family
    font.pixelSize: Style.font.bodySmall
    maximumLineCount: 2
    elide: Text.ElideRight
    wrapMode: Text.WordWrap
  }

  MouseArea {
    anchors.fill: parent
    cursorShape: card.notification.url ? Qt.PointingHandCursor : Qt.ArrowCursor
    onClicked: card.openRequested(String(card.notification.url || ""))
  }
}
