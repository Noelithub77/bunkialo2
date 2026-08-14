// mess menu data - August 2026

export type MealType = "breakfast" | "lunch" | "snacks" | "dinner";

export interface Meal {
  type: MealType;
  name: string;
  items: string[];
  startTime: string;
  endTime: string;
}

export interface DayMenu {
  day: number; // 0=Sun, 1=Mon, etc
  meals: Meal[];
}

export const MEAL_COLORS: Record<MealType, string> = {
  breakfast: "#62df15", // green
  lunch: "#1be7a3", // emerald
  snacks: "#b16d07", // orange
  dinner: "#6d20b0", // purple
};

export const MEAL_TIMES: Record<
  MealType,
  { start: string; end: string; name: string }
> = {
  breakfast: { start: "07:00", end: "09:45", name: "Breakfast" },
  lunch: { start: "12:00", end: "14:30", name: "Lunch" },
  snacks: { start: "16:00", end: "18:00", name: "Snacks" },
  dinner: { start: "19:00", end: "21:00", name: "Dinner" },
};

const createMeal = (type: MealType, items: string[]): Meal => ({
  type,
  name: MEAL_TIMES[type].name,
  items,
  startTime: MEAL_TIMES[type].start,
  endTime: MEAL_TIMES[type].end,
});

export const MESS_MENU: DayMenu[] = [
  // sunday (0)
  {
    day: 0,
    meals: [
      createMeal("breakfast", [
        "Puri Masala",
        "Pongal",
        "Groundnut chutney",
        "Banana",
        "Boiled Egg",
        "Sprouts",
        "Bread (Normal/Brown)",
        "Jam",
        "Tea",
        "Milk",
      ]),
      createMeal("lunch", [
        "Kerala rice",
        "Rice",
        "Roti",
        "Aloo Tomato gravy",
        "Bottle gourd stir fry",
        "Palak Dal tadka",
        "Rasam",
        "Curd",
        "Salad",
        "Drink: Sweet Lassi",
      ]),
      createMeal("snacks", [
        "Roasted/Boiled Peanuts",
        "Banana",
        "Bread",
        "Jam",
        "Butter",
        "Tea",
        "Milk",
      ]),
      createMeal("dinner", [
        "Hyderabadi/Malabar Chicken Biryani",
        "Paneer Biryani",
        "Veg Gravy",
        "Chicken Gravy",
        "Onion Chilli Raita",
        "Papad",
        "Salad",
        "Drink: Tang",
      ]),
    ],
  },
  // monday (1)
  {
    day: 1,
    meals: [
      createMeal("breakfast", [
        "Onion",
        "Uttapam",
        "Medu vada",
        "Sambar",
        "Coconut Chutney",
        "Bread (Normal/Brown)",
        "Jam",
        "Butter",
        "Tea",
        "Milk",
        "Corn Flakes",
      ]),
      createMeal("lunch", [
        "Kerala rice",
        "Rice",
        "Roti",
        "Veg Kolhapuri",
        "Beans Poriyal",
        "Olan",
        "Sambar",
        "Chips",
        "Salad",
        "Puliyinchi",
        "Curd",
      ]),
      createMeal("snacks", [
        "Masala Puri chaat",
        "Bread",
        "Jam",
        "Butter",
        "Coffee",
        "Milk",
      ]),
      createMeal("dinner", [
        "Rice",
        "Roti",
        "Egg roast",
        "Beetroot thoran",
        "Vegetable Kurma",
        "Papad",
        "Curd",
        "Salad",
      ]),
    ],
  },
  // tuesday (2)
  {
    day: 2,
    meals: [
      createMeal("breakfast", [
        "Vada Pav",
        "Puttu",
        "Channa Curry",
        "Fried Chillies",
        "Onions",
        "Green Chutney",
        "Red Powdered Chutney",
        "Bread (Normal/Brown)",
        "Jam",
        "Butter",
        "Coffee",
        "Milk",
        "Banana",
      ]),
      createMeal("lunch", [
        "Tawa Pulao",
        "Roti",
        "Chettinad Chicken",
        "Chilli Paneer",
        "Vegetable",
        "Raita",
        "Salad",
        "Drink: Lemon juice/Litchi",
      ]),
      createMeal("snacks", [
        "Cream bun",
        "Bread",
        "Jam",
        "Butter",
        "Tea",
        "Milk",
      ]),
      createMeal("dinner", [
        "Rice",
        "Roti",
        "Chole curry",
        "Onion Dal Tadka",
        "Carrot Beans Thoran",
        "Rasam",
        "Chips",
        "Salad",
        "Curd",
      ]),
    ],
  },
  // wednesday (3)
  {
    day: 3,
    meals: [
      createMeal("breakfast", [
        "Idli",
        "Masala Idli",
        "Punugulu",
        "Sambar",
        "Groundnut Chutney",
        "Tomato chutney",
        "Puliyinchi",
        "Bread (Normal/Brown)",
        "Jam",
        "Butter",
        "Tea",
        "Milk",
      ]),
      createMeal("lunch", [
        "Rice",
        "Roti",
        "Mudda Pappu",
        "Pachi Pulusu",
        "Cabbage fry",
        "Curd",
        "Kootu curry",
        "Salad",
        "Drink: Sweet Lassi",
      ]),
      createMeal("snacks", [
        "Sweetcorn (boiled)",
        "Bread",
        "Jam",
        "Butter",
        "Tea",
        "Milk",
      ]),
      createMeal("dinner", [
        "Vegetable Fried rice",
        "Roti",
        "Paneer Butter masala",
        "Chilli chicken",
        "Onion chilli Raita",
        "Drink: Passion Fruit drink",
      ]),
    ],
  },
  // thursday (4)
  {
    day: 4,
    meals: [
      createMeal("breakfast", [
        "Pav Bhaji",
        "Lemons",
        "Onions",
        "Uggani (Puffed rice)",
        "Roasted chana Podi",
        "Bread (Normal/Brown)",
        "Jam",
        "Butter",
        "Banana",
        "Coffee",
        "Milk",
      ]),
      createMeal("lunch", [
        "Rice",
        "Roti",
        "Egg Bhurji",
        "Sambar",
        "Green Peas curry",
        "Papad",
        "Curd",
        "Salad",
        "Drink: Sweet Lassi",
      ]),
      createMeal("snacks", [
        "Dil Pasand",
        "Bread",
        "Jam",
        "Butter",
        "Coffee",
        "Milk",
      ]),
      createMeal("dinner", [
        "Roti",
        "Rice",
        "Sambar",
        "Potato fry",
        "Kanji",
        "Chammanthi",
        "Curd",
        "Brinjal Curry",
        "Salad",
        "Sweet: Rava Kesari",
      ]),
    ],
  },
  // friday (5)
  {
    day: 5,
    meals: [
      createMeal("breakfast", [
        "Vermicelli upma",
        "Poha",
        "Lemons",
        "Groundnut Chutney",
        "Bread (Normal/Brown)",
        "Jam",
        "Butter",
        "Banana",
        "Tea",
        "Milk",
      ]),
      createMeal("lunch", [
        "Ghee Rice",
        "Chicken Roast",
        "Kadai Paneer",
        "Vegetable raita",
        "Salad",
        "Drink: Lemon juice / Litchi",
      ]),
      createMeal("snacks", [
        "Bhel puri",
        "Bread",
        "Jam",
        "Butter",
        "Tea",
        "Milk",
      ]),
      createMeal("dinner", [
        "Rice",
        "Roti",
        "Rajma curry",
        "Spicy Dal Tadka",
        "Rasam",
        "Ivy Gourd Fry",
        "Pulisherry",
        "Salad",
        "Sweet: Ada Payasam",
      ]),
    ],
  },
  // saturday (6)
  {
    day: 6,
    meals: [
      createMeal("breakfast", [
        "Idli",
        "Podi Idly",
        "Kichidhi Sprouts",
        "Groundnut Chutney",
        "Tomato chutney",
        "Sambar",
        "Bread (Normal/Brown)",
        "Jam",
        "Butter",
        "Coffee",
        "Milk",
        "Corn Flakes",
      ]),
      createMeal("lunch", [
        "Rice",
        "Roti",
        "Mudda pappu",
        "Pachi pulusu",
        "Cabbage carrot thoran",
        "Chips",
        "Curd",
        "Salad",
        "Drink: Buttermilk",
      ]),
      createMeal("snacks", [
        "Onion Vada",
        "Bread",
        "Jam",
        "Butter",
        "Coffee",
        "Milk",
      ]),
      createMeal("dinner", [
        "Jeera Rice",
        "Rice",
        "Roti",
        "Small Soya curry",
        "Sambar",
        "Puliseery",
        "Chips",
        "Curd",
        "Salad",
        "Sweet: Vermicelli Payasam",
      ]),
    ],
  },
];

// get menu for a specific day
export const getMenuForDay = (dayOfWeek: number): DayMenu | undefined => {
  return MESS_MENU.find((menu) => menu.day === dayOfWeek);
};

// get current or next meal based on time
export const getCurrentMeal = (
  now: Date,
): { current: Meal | null; next: Meal | null } => {
  const dayMenu = getMenuForDay(now.getDay());
  if (!dayMenu) return { current: null, next: null };

  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  let current: Meal | null = null;
  let next: Meal | null = null;

  for (const meal of dayMenu.meals) {
    if (currentTime >= meal.startTime && currentTime < meal.endTime) {
      current = meal;
    } else if (currentTime < meal.startTime && !next) {
      next = meal;
    }
  }

  // if no next meal today, get first meal of tomorrow
  if (!current && !next) {
    const tomorrowMenu = getMenuForDay((now.getDay() + 1) % 7);
    next = tomorrowMenu?.meals[0] || null;
  }

  return { current, next };
};

// get all meals for carousel with nearby context
export const getNearbyMeals = (
  now: Date,
): { meals: Meal[]; initialIndex: number } => {
  const dayMenu = getMenuForDay(now.getDay());
  if (!dayMenu) return { meals: [], initialIndex: 0 };

  const currentTime = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  let initialIndex = 0;
  for (let i = 0; i < dayMenu.meals.length; i++) {
    const meal = dayMenu.meals[i];
    if (currentTime >= meal.startTime && currentTime < meal.endTime) {
      initialIndex = i;
      break;
    } else if (currentTime < meal.startTime) {
      initialIndex = i;
      break;
    } else {
      initialIndex = i;
    }
  }

  return { meals: dayMenu.meals, initialIndex };
};
