// Test script for timetable session type detection

// calculate duration between two times in minutes
const calculateDuration = (startTime, endTime) => {
  const [startHour, startMin] = startTime.split(":").map(Number);
  const [endHour, endMin] = endTime.split(":").map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  return endMinutes - startMinutes;
};

const getSessionType = (desc, startTime, endTime) => {
  const lower = desc.toLowerCase();
  // first check description for explicit mentions
  if (lower.includes("lab")) return "lab";
  if (lower.includes("tutorial")) return "tutorial";

  // auto-detect based on duration if times are provided
  if (startTime && endTime) {
    const duration = calculateDuration(startTime, endTime);
    // 2-hour slots (typically 110-120 minutes) are labs
    if (duration >= 110) return "lab";
  }

  return "regular";
};

// Test cases
console.log("Testing timetable session type detection:\n");

// Test 1: Regular 1-hour class
const test1 = getSessionType("Data Structures", "10:00", "10:55");
console.log(`1. "Data Structures" (10:00-10:55): ${test1} (expected: regular)`);

// Test 2: 2-hour lab slot
const test2 = getSessionType("Programming", "14:00", "16:00");
console.log(`2. "Programming" (14:00-16:00): ${test2} (expected: lab)`);

// Test 3: Explicit lab in description
const test3 = getSessionType("DS Lab", "10:00", "10:55");
console.log(`3. "DS Lab" (10:00-10:55): ${test3} (expected: lab)`);

// Test 4: Explicit tutorial
const test4 = getSessionType("Math Tutorial", "15:00", "15:55");
console.log(`4. "Math Tutorial" (15:00-15:55): ${test4} (expected: tutorial)`);

// Test 5: Edge case - 105 minute class
const test5 = getSessionType("Long Class", "08:00", "09:45");
console.log(
  `5. "Long Class" (08:00-09:45): ${test5} (expected: regular, duration: 105min)`,
);

// Test 6: Edge case - 110 minute class
const test6 = getSessionType("Long Class", "08:00", "09:50");
console.log(
  `6. "Long Class" (08:00-09:50): ${test6} (expected: lab, duration: 110min)`,
);

// Test durations
console.log("\nDuration calculations:");
console.log(`10:00-10:55: ${calculateDuration("10:00", "10:55")} minutes`);
console.log(`14:00-16:00: ${calculateDuration("14:00", "16:00")} minutes`);
console.log(`08:00-09:45: ${calculateDuration("08:00", "09:45")} minutes`);
console.log(`08:00-09:50: ${calculateDuration("08:00", "09:50")} minutes`);
