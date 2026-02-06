import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import type { Faculty } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { memo } from "react";
import { Pressable, Text, View } from "react-native";

interface FacultyCardProps {
  faculty: Faculty;
  onPress: () => void;
  matchedFields?: string[];
}

export const FacultyCard = memo(function FacultyCard({
  faculty,
  onPress,
  matchedFields,
}: FacultyCardProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const handlePhone = () => {
    if (faculty.contact.phone) {
      const phone = faculty.contact.phone.replace(/[^0-9+]/g, "");
      Linking.openURL(`tel:${phone}`);
    }
  };

  const handleEmail = () => {
    if (faculty.contact.email) {
      Linking.openURL(`mailto:${faculty.contact.email}`);
    }
  };

  const handleWebpage = () => {
    if (faculty.page.link) {
      Linking.openURL(faculty.page.link);
    }
  };

  return (
    <Pressable
      className="flex-row items-center justify-between gap-4 rounded-xl p-4"
      style={{ backgroundColor: theme.backgroundSecondary }}
      onPress={onPress}
    >
      <View className="flex-1 flex-row items-center gap-4">
        {faculty.imageUrl ? (
          <Image
            source={{ uri: faculty.imageUrl }}
            className="h-12 w-12 rounded-full"
            contentFit="cover"
            style={{ height: 48, width: 48, borderRadius: 999 }}
          />
        ) : (
          <View
            className="h-12 w-12 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.border }}
          >
            <Ionicons name="person" size={24} color={theme.textSecondary} />
          </View>
        )}

        <View className="flex-1">
          <Text className="text-[15px] font-semibold" style={{ color: theme.text }} numberOfLines={1}>
            {faculty.name}
          </Text>
          <Text
            className="text-[12px]"
            style={{ color: theme.textSecondary }}
            numberOfLines={1}
          >
            {faculty.designation}
          </Text>
          {faculty.contact.room && (
            <View className="mt-0.5 flex-row items-center gap-1">
              <Ionicons
                name="location-outline"
                size={12}
                color={Colors.status.info}
              />
              <Text className="text-[11px] font-medium" style={{ color: Colors.status.info }}>
                {faculty.contact.room}
              </Text>
            </View>
          )}
          {matchedFields && matchedFields.length > 0 && (
            <Text
              className="mt-1 text-[11px] font-medium"
              style={{ color: theme.textSecondary }}
              numberOfLines={1}
            >
              Matched in: {matchedFields.join(", ")}
            </Text>
          )}
        </View>
      </View>

      <View className="flex-row gap-2">
        {faculty.contact.phone && (
          <Pressable
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: isDark ? Colors.gray[800] : Colors.gray[200] }}
            onPress={handlePhone}
            hitSlop={8}
          >
            <Ionicons name="call-outline" size={18} color={theme.text} />
          </Pressable>
        )}
        {faculty.contact.email && (
          <Pressable
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: isDark ? Colors.gray[800] : Colors.gray[200] }}
            onPress={handleEmail}
            hitSlop={8}
          >
            <Ionicons name="mail-outline" size={18} color={theme.text} />
          </Pressable>
        )}
        {faculty.page.link && (
          <Pressable
            className="h-9 w-9 items-center justify-center rounded-full"
            style={{ backgroundColor: isDark ? Colors.gray[800] : Colors.gray[200] }}
            onPress={handleWebpage}
            hitSlop={8}
          >
            <Ionicons name="globe-outline" size={18} color={theme.text} />
          </Pressable>
        )}
      </View>
    </Pressable>
  );
});
