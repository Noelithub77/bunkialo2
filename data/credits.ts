interface CourseCredit {
  code: string;
  credits: number;
}

const COURSE_CREDITS: CourseCredit[] = [
  { code: "IMA111", credits: 4 },
  { code: "ICS111", credits: 5 },
  { code: "ICS112", credits: 5 },
  { code: "IEC111", credits: 5 },
  { code: "IHS111", credits: 3 },
  { code: "IHS112", credits: 1 },
  { code: "IMA121", credits: 4 },
  { code: "IEC121", credits: 5 },
  { code: "ICS121", credits: 5 },
  { code: "ICS122", credits: 4 },
  { code: "ICS123", credits: 4 },
  { code: "IHS121", credits: 1 },
  { code: "IMA211", credits: 4 },
  { code: "ICS211", credits: 4 },
  { code: "ICS212", credits: 4 },
  { code: "ICS213", credits: 4 },
  { code: "ICS214", credits: 4 },
  { code: "ICS215", credits: 2 },
  { code: "ISC213", credits: 2 },
  { code: "IMA221", credits: 4 },
  { code: "ICS221", credits: 4 },
  { code: "ICS222", credits: 4 },
  { code: "ICS223", credits: 4 },
  { code: "ICS224", credits: 4 },
  { code: "ICS225", credits: 2 },
  { code: "IHS221", credits: 1 },
  { code: "IHS222", credits: 1 },
  { code: "CSE311", credits: 4 },
  { code: "CSE312", credits: 4 },
  { code: "CSS311", credits: 4 },
  { code: "IEG311", credits: 4 },
  { code: "IEG313", credits: 4 },
  { code: "IMA311", credits: 3 },
  { code: "IMA314", credits: 3 },
  { code: "IHS311", credits: 1 },
  { code: "IHS312", credits: 1 },
  { code: "IHS313", credits: 1 },
  { code: "CSE321", credits: 4 },
  { code: "CSE322", credits: 4 },
  { code: "CSS321", credits: 4 },
  { code: "CSS322", credits: 3 },
  { code: "CSE411", credits: 4 },
  { code: "CSE412", credits: 4 },
  { code: "CSE413", credits: 4 },
  { code: "CSS411", credits: 4 },
  { code: "CSS422", credits: 3 },
  { code: "IOE421", credits: 3 },
  { code: "IOE414", credits: 3 },
  { code: "IBP414", credits: 6 },
  { code: "IBP424", credits: 6 },
  { code: "IRP511", credits: 12 },
  { code: "IRP521", credits: 12 },
  { code: "IEC112", credits: 4 },
  { code: "IEC122", credits: 4 },
  { code: "IEC211", credits: 3 },
  { code: "IEC212", credits: 4 },
  { code: "IEC213", credits: 4 },
  { code: "IEC214", credits: 4 },
  { code: "IEC215", credits: 4 },
  { code: "IEC221", credits: 4 },
  { code: "IEC222", credits: 4 },
  { code: "IEC223", credits: 4 },
  { code: "ECS321", credits: 4 },
  { code: "IEG314", credits: 4 },
  { code: "IMA312", credits: 3 },
  { code: "ECE312", credits: 4 },
  { code: "ECE323", credits: 4 },
  { code: "ECE322", credits: 4 },
  { code: "ECE411", credits: 4 },
  { code: "ECE412", credits: 4 },
  { code: "ECS324", credits: 4 },
  { code: "IBP411", credits: 6 },
  { code: "IBP421", credits: 6 },
  { code: "ISC211", credits: 2 },
  { code: "ISC212", credits: 2 },
  { code: "ICS226", credits: 4 },
  { code: "IHS223", credits: 1 },
  { code: "CBE311", credits: 3 },
  { code: "IEC312", credits: 4 },
  { code: "CBE312", credits: 4 },
  { code: "CBS311", credits: 4 },
  { code: "IMA313", credits: 3 },
  { code: "IHS314", credits: 3 },
  { code: "CBS312", credits: 1 },
  { code: "CBE321", credits: 3 },
  { code: "CBE322", credits: 4 },
  { code: "CBS321", credits: 4 },
  { code: "CBE323", credits: 4 },
  { code: "ISC322", credits: 3 },
  { code: "IOE322", credits: 3 },
  { code: "CBS411", credits: 4 },
  { code: "CBE411", credits: 4 },
  { code: "CBE412", credits: 4 },
  { code: "IOE411", credits: 3 },
  { code: "CBS421", credits: 3 },
  { code: "CBS422", credits: 4 },
  { code: "IOE422", credits: 3 },
  { code: "IBP413", credits: 6 },
  { code: "IBP423", credits: 6 },
  { code: "ISC321", credits: 3 },
];

// fuzzy match - case-insensitive, handles partial matches
export const findCreditsByCode = (courseCode: string): number | null => {
  if (!courseCode) return null;

  const normalized = courseCode.toUpperCase().trim();

  // exact match first
  const exact = COURSE_CREDITS.find((c) => c.code.toUpperCase() === normalized);
  if (exact) return exact.credits;

  // partial match - check if course code contains the known code or vice versa
  const partial = COURSE_CREDITS.find(
    (c) =>
      normalized.includes(c.code.toUpperCase()) ||
      c.code.toUpperCase().includes(normalized),
  );
  if (partial) return partial.credits;

  return null;
};
