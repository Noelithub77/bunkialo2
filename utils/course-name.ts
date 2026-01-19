const extractCourseName = (courseName: string): string => {
  console.log("[COURSE_NAME] === FUNCTION CALLED ===");
  console.log("[COURSE_NAME] Raw input:", JSON.stringify(courseName));
  console.log("[COURSE_NAME] Input length:", courseName.length);
  console.log("[COURSE_NAME] Input type:", typeof courseName);

  const trimmed = courseName.trim();
  console.log("[COURSE_NAME] Trimmed:", JSON.stringify(trimmed));

  const patterns = [
    /^[\w\d]+\s*[-:]\s*/, // "CS101 - " or "CS101: "
    /^[\w\d]+\s{2,}/, // "ICS221  " (two or more spaces)
    /^[\w\d]+\s+/, // "CS101 Data Structures" (single space)
  ];

  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    console.log(`[COURSE_NAME] Testing pattern ${i}:`, pattern);
    console.log(
      `[COURSE_NAME] Pattern ${i} test result:`,
      pattern.test(trimmed),
    );

    if (pattern.test(trimmed)) {
      const result = trimmed.replace(pattern, "").trim();
      console.log(
        `[COURSE_NAME] Pattern ${i} MATCHED! Result:`,
        JSON.stringify(result),
      );
      return result;
    }
  }

  console.log(
    "[COURSE_NAME] No pattern matched, returning original:",
    JSON.stringify(trimmed),
  );
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
