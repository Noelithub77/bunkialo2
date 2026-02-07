import { Container } from "@/components/ui/container";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useFacultyStore } from "@/stores/faculty-store";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { router, useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import ImageViewing from "react-native-image-viewing";
import { Pressable, ScrollView, Text, View } from "react-native";

export default function FacultyDetailScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const theme = isDark ? Colors.dark : Colors.light;

  const { id } = useLocalSearchParams<{ id: string }>();
  const { faculties } = useFacultyStore();
  const [isImageViewerVisible, setIsImageViewerVisible] = useState(false);

  const faculty = useMemo(() => {
    return faculties.find((f) => f.id === id);
  }, [faculties, id]);

  if (!faculty) {
    return (
      <Container>
        <View className="flex-1 items-center justify-center gap-4">
          <Ionicons
            name="person-outline"
            size={48}
            color={theme.textSecondary}
          />
          <Text className="text-base" style={{ color: theme.textSecondary }}>
            Faculty not found
          </Text>
          <Pressable onPress={() => router.back()} className="mt-4">
            <Text className="text-[15px] font-medium" style={{ color: Colors.status.info }}>
              Go Back
            </Text>
          </Pressable>
        </View>
      </Container>
    );
  }

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

  const viewerBackgroundColor = isDark ? "#040712F5" : "#0B1220F0";

  return (
    <Container>
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-4 pb-8"
        showsVerticalScrollIndicator={false}
      >
        {/* header with back button */}
        <View className="mb-4">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: theme.backgroundSecondary }}
            hitSlop={8}
          >
            <Ionicons name="arrow-back" size={20} color={theme.text} />
          </Pressable>
        </View>

        {/* profile section */}
        <View className="mb-6 items-center">
          {faculty.imageUrl ? (
            <Pressable
              onPress={() => setIsImageViewerVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={`View ${faculty.name} profile image`}
              className="mb-4"
            >
              <Image
                source={{ uri: faculty.imageUrl }}
                className="h-[100px] w-[100px] rounded-full"
                contentFit="cover"
                style={{ height: 100, width: 100, borderRadius: 999 }}
              />
            </Pressable>
          ) : (
            <View
              className="mb-4 h-[100px] w-[100px] items-center justify-center rounded-full"
              style={{ backgroundColor: theme.backgroundSecondary }}
            >
              <Ionicons name="person" size={48} color={theme.textSecondary} />
            </View>
          )}

          <Text className="text-[22px] font-bold text-center" style={{ color: theme.text }}>
            {faculty.name}
          </Text>
          <Text className="mt-1 text-[15px] text-center" style={{ color: theme.textSecondary }}>
            {faculty.designation}
          </Text>

          {faculty.additionalRole && (
            <Text
              className="mt-2 text-[13px] font-medium text-center"
              style={{ color: Colors.status.info }}
            >
              {faculty.additionalRole}
            </Text>
          )}
        </View>

        {/* quick actions */}
        <View className="mb-6 flex-row gap-4">
          {faculty.contact.phone && (
            <Pressable
              className="flex-1 items-center justify-center gap-1.5 rounded-xl py-4"
              style={{ backgroundColor: theme.backgroundSecondary }}
              onPress={handlePhone}
            >
              <Ionicons name="call" size={22} color={Colors.status.success} />
              <Text className="text-[12px] font-medium" style={{ color: theme.text }}>
                Call
              </Text>
            </Pressable>
          )}
          {faculty.contact.email && (
            <Pressable
              className="flex-1 items-center justify-center gap-1.5 rounded-xl py-4"
              style={{ backgroundColor: theme.backgroundSecondary }}
              onPress={handleEmail}
            >
              <Ionicons name="mail" size={22} color={Colors.status.info} />
              <Text className="text-[12px] font-medium" style={{ color: theme.text }}>
                Email
              </Text>
            </Pressable>
          )}
          {faculty.page.link && (
            <Pressable
              className="flex-1 items-center justify-center gap-1.5 rounded-xl py-4"
              style={{ backgroundColor: theme.backgroundSecondary }}
              onPress={handleWebpage}
            >
              <Ionicons name="globe" size={22} color={Colors.status.warning} />
              <Text className="text-[12px] font-medium" style={{ color: theme.text }}>
                Website
              </Text>
            </Pressable>
          )}
        </View>

        {/* contact details */}
        <View
          className="mb-4 rounded-xl p-4"
          style={{ backgroundColor: theme.backgroundSecondary }}
        >
          <Text className="mb-4 text-[16px] font-semibold" style={{ color: theme.text }}>
            Contact
          </Text>

          {faculty.contact.room && (
            <View className="mb-4 flex-row items-start gap-4">
              <Ionicons
                name="location-outline"
                size={18}
                color={Colors.status.info}
              />
              <View className="flex-1">
                <Text
                  className="mb-0.5 text-[11px] uppercase tracking-[0.5px]"
                  style={{ color: theme.textSecondary }}
                >
                  Room
                </Text>
                <Text className="text-[14px]" style={{ color: theme.text }}>
                  {faculty.contact.room}
                </Text>
              </View>
            </View>
          )}

          {faculty.contact.phone && (
            <View className="mb-4 flex-row items-start gap-4">
              <Ionicons
                name="call-outline"
                size={18}
                color={theme.textSecondary}
              />
              <View className="flex-1">
                <Text
                  className="mb-0.5 text-[11px] uppercase tracking-[0.5px]"
                  style={{ color: theme.textSecondary }}
                >
                  Phone
                </Text>
                <Text className="text-[14px]" style={{ color: theme.text }}>
                  {faculty.contact.phone}
                </Text>
              </View>
            </View>
          )}

          {faculty.contact.email && (
            <View className="flex-row items-start gap-4">
              <Ionicons
                name="mail-outline"
                size={18}
                color={theme.textSecondary}
              />
              <View className="flex-1">
                <Text
                  className="mb-0.5 text-[11px] uppercase tracking-[0.5px]"
                  style={{ color: theme.textSecondary }}
                >
                  Email
                </Text>
                <Text className="text-[14px]" style={{ color: theme.text }}>
                  {faculty.contact.email}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* areas of expertise */}
        {faculty.areas.length > 0 && (
          <View
            className="mb-4 rounded-xl p-4"
            style={{ backgroundColor: theme.backgroundSecondary }}
          >
            <Text className="mb-4 text-[16px] font-semibold" style={{ color: theme.text }}>
              Areas of Expertise
            </Text>
            <View className="flex-row flex-wrap gap-2">
              {faculty.areas.map((area, index) => (
                <View
                  key={index}
                  className="rounded-full px-4 py-1.5"
                  style={{
                    backgroundColor: isDark ? Colors.gray[800] : Colors.gray[200],
                  }}
                >
                  <Text className="text-[13px]" style={{ color: theme.text }}>
                    {area}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* qualification */}
        {faculty.qualification && (
          <View
            className="mb-4 rounded-xl p-4"
            style={{ backgroundColor: theme.backgroundSecondary }}
          >
            <Text className="mb-4 text-[16px] font-semibold" style={{ color: theme.text }}>
              Qualification
            </Text>
            <Text
              className="text-[14px] leading-5"
              style={{ color: theme.textSecondary }}
            >
              {faculty.qualification}
            </Text>
          </View>
        )}
      </ScrollView>
      {faculty.imageUrl ? (
        <ImageViewing
          images={[{ uri: faculty.imageUrl }]}
          imageIndex={0}
          visible={isImageViewerVisible}
          onRequestClose={() => setIsImageViewerVisible(false)}
          backgroundColor={viewerBackgroundColor}
          swipeToCloseEnabled
          doubleTapToZoomEnabled
          presentationStyle="overFullScreen"
          HeaderComponent={() => (
            <View className="px-5 pt-14">
              <View className="flex-row items-start justify-between">
                <View
                  className="max-w-[80%] rounded-2xl px-4 py-2.5"
                  style={{ backgroundColor: "#FFFFFF1A" }}
                >
                  <Text className="text-[16px] font-semibold text-white">
                    {faculty.name}
                  </Text>
                  <Text className="mt-0.5 text-[12px] text-white/80">
                    {faculty.designation}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setIsImageViewerVisible(false)}
                  className="h-10 w-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: "#FFFFFF22" }}
                  hitSlop={8}
                >
                  <Ionicons name="close" size={20} color="#FFFFFF" />
                </Pressable>
              </View>
            </View>
          )}
          FooterComponent={() => (
            <View className="items-center px-6 pb-12">
              <View
                className="rounded-full px-4 py-2"
                style={{ backgroundColor: "#FFFFFF1A" }}
              >
                <Text className="text-[12px] text-white/90">
                  Pinch or double-tap to zoom • Swipe down to close
                </Text>
              </View>
            </View>
          )}
        />
      ) : null}
    </Container>
  );
}
