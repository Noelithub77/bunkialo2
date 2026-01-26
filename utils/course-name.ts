const extractCourseName = (courseName: string): string => {
  const trimmed = courseName.trim();

  const patterns = [
    /^[\w\d]+\s*[-:]\s*/, // "CS101 - " or "CS101: "
    /^[\w\d]+\s{2,}/, // "ICS221  " (two or more spaces)
    /^[\w\d]+\s+/, // "CS101 Data Structures" (single space)
  ];

  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];

    if (pattern.test(trimmed)) {
      const result = trimmed.replace(pattern, "").trim();
      return result;
    }
  }
  return trimmed;
};

const extractCourseCode = (courseName: string): string => {
  const trimmed = courseName.trim();

  const patterns = [
    /^([\w\d]+)\s*[-:]\s*/, // "CS101 - " or "CS101: "
    /^([\w\d]+)\s{2,}/, // "ICS221  " (two or more spaces)
    /^([\w\d]+)\s+/, // "CS101 Data Structures" (single space)
  ];

  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return trimmed;
};

export { extractCourseCode, extractCourseName };
