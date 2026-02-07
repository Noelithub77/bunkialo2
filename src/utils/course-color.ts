import { Colors } from "@/constants/theme";

export const getRandomCourseColor = (): string => {
  return Colors.courseColors[
    Math.floor(Math.random() * Colors.courseColors.length)
  ];
};
