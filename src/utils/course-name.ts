const courseCodePrefix = /^([A-Za-z]{2,}\s*\d{2,})\s*(?:[-:]\s*)?/;

const extractCourseName = (courseName: string): string => {
  const trimmed = courseName.trim();
  const match = trimmed.match(courseCodePrefix);
  return match ? trimmed.slice(match[0].length).trim() : trimmed;
};

const extractCourseCode = (courseName: string): string => {
  const trimmed = courseName.trim();
  const match = trimmed.match(courseCodePrefix);
  return match ? match[1].replace(/\s+/g, "") : trimmed;
};

export { extractCourseCode, extractCourseName };
