import { Button } from "@/components/ui/button";
import { Colors, Radius, Spacing } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getDayName, formatTimeDisplay } from "@/stores/timetable-store";
import type { SlotConflict } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

interface SlotConflictModalProps {
  visible: boolean;
  conflicts: SlotConflict[];
  onResolve: (conflictIndex: number, keep: "manual" | "auto") => void;
  onClose: () => void;
}

export function SlotConflictModal({
  visible,
  conflicts,
  onResolve,
  onClose,
}: SlotConflictModalProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const handleResolve = (index: number, keep: "manual" | "auto") => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onResolve(index, keep);
  };

  if (conflicts.length === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.modal, { backgroundColor: theme.background }]}>
          {/* header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View
                style={[
                  styles.iconBadge,
                  { backgroundColor: Colors.status.warning + "20" },
                ]}
              >
                <Ionicons
                  name="warning"
                  size={20}
                  color={Colors.status.warning}
                />
              </View>
              <Text style={[styles.title, { color: theme.text }]}>
                Slot Conflicts
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={24} color={theme.textSecondary} />
            </Pressable>
          </View>

          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {conflicts.length} conflict{conflicts.length > 1 ? "s" : ""} found.
            Choose which slot to keep for each.
          </Text>

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {conflicts.map((conflict, index) => (
              <View
                key={index}
                style={[
                  styles.conflictCard,
                  { backgroundColor: theme.backgroundSecondary },
                ]}
              >
                <Text style={[styles.conflictTitle, { color: theme.text }]}>
                  Conflict #{index + 1}
                </Text>
                <Text
                  style={[styles.conflictDay, { color: theme.textSecondary }]}
                >
                  {getDayName(conflict.manualSlot.dayOfWeek, false)} at{" "}
                  {formatTimeDisplay(conflict.manualSlot.startTime)}
                </Text>

                {/* manual slot */}
                <View style={styles.slotRow}>
                  <View style={styles.slotInfo}>
                    <View style={styles.slotHeader}>
                      <View
                        style={[
                          styles.slotBadge,
                          { backgroundColor: Colors.status.info + "20" },
                        ]}
                      >
                        <Text
                          style={[
                            styles.slotBadgeText,
                            { color: Colors.status.info },
                          ]}
                        >
                          Manual
                        </Text>
                      </View>
                      {conflict.manualSlot.isCustomCourse && (
                        <View
                          style={[
                            styles.slotBadge,
                            { backgroundColor: Colors.status.success + "20" },
                          ]}
                        >
                          <Text
                            style={[
                              styles.slotBadgeText,
                              { color: Colors.status.success },
                            ]}
                          >
                            Custom
                          </Text>
                        </View>
                      )}
                    </View>
                    <Text
                      style={[styles.slotName, { color: theme.text }]}
                      numberOfLines={1}
                    >
                      {conflict.manualSlot.courseName}
                    </Text>
                    <Text
                      style={[styles.slotTime, { color: theme.textSecondary }]}
                    >
                      {formatTimeDisplay(conflict.manualSlot.startTime)} -{" "}
                      {formatTimeDisplay(conflict.manualSlot.endTime)}
                    </Text>
                  </View>
                  <Button
                    title="Keep"
                    variant="secondary"
                    onPress={() => handleResolve(index, "manual")}
                    style={styles.keepBtn}
                  />
                </View>

                <View style={[styles.divider, { backgroundColor: theme.border }]}>
                  <Text style={[styles.dividerText, { color: theme.textSecondary }]}>
                    OR
                  </Text>
                </View>

                {/* auto slot */}
                <View style={styles.slotRow}>
                  <View style={styles.slotInfo}>
                    <View style={styles.slotHeader}>
                      <View
                        style={[
                          styles.slotBadge,
                          { backgroundColor: theme.border },
                        ]}
                      >
                        <Text
                          style={[
                            styles.slotBadgeText,
                            { color: theme.textSecondary },
                          ]}
                        >
                          Auto (LMS)
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={[styles.slotName, { color: theme.text }]}
                      numberOfLines={1}
                    >
                      {conflict.autoSlot.courseName}
                    </Text>
                    <Text
                      style={[styles.slotTime, { color: theme.textSecondary }]}
                    >
                      {formatTimeDisplay(conflict.autoSlot.startTime)} -{" "}
                      {formatTimeDisplay(conflict.autoSlot.endTime)}
                    </Text>
                  </View>
                  <Button
                    title="Keep"
                    variant="secondary"
                    onPress={() => handleResolve(index, "auto")}
                    style={styles.keepBtn}
                  />
                </View>
              </View>
            ))}
          </ScrollView>

          {/* close button */}
          <View style={styles.actions}>
            <Button
              title="Close"
              variant="secondary"
              onPress={onClose}
              style={styles.btn}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  modal: {
    width: "92%",
    maxWidth: 420,
    maxHeight: "85%",
    borderRadius: Radius.lg,
    padding: Spacing.lg,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 13,
    marginBottom: Spacing.md,
  },
  content: {
    flexGrow: 0,
  },
  conflictCard: {
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: Spacing.md,
  },
  conflictTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: Spacing.xs,
  },
  conflictDay: {
    fontSize: 12,
    marginBottom: Spacing.md,
  },
  slotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  slotInfo: {
    flex: 1,
  },
  slotHeader: {
    flexDirection: "row",
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  slotBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
  },
  slotBadgeText: {
    fontSize: 10,
    fontWeight: "600",
  },
  slotName: {
    fontSize: 13,
    fontWeight: "500",
  },
  slotTime: {
    fontSize: 11,
  },
  keepBtn: {
    minWidth: 70,
  },
  divider: {
    height: 1,
    marginVertical: Spacing.md,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  dividerText: {
    fontSize: 10,
    fontWeight: "600",
    position: "absolute",
    paddingHorizontal: Spacing.sm,
  },
  actions: {
    marginTop: Spacing.md,
  },
  btn: {
    flex: 1,
  },
});
