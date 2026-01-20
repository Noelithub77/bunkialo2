// mess menu data - november 2025

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
  breakfast: "#62df15ff", // amber
  lunch: "#1be7a3ff", // emerald
  snacks: "#b16d07ff", // violet
  dinner: "#6d20b0ff", // blue
};

export const MEAL_TIMES: Record<
  MealType,
  { start: string; end: string; name: string }
> = {
  breakfast: { start: "07:00", end: "09:45", name: "Breakfast" },
  lunch: { start: "11:45", end: "14:30", name: "Lunch" },
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
        "Bread(Normal/Brown)",
        "Jam",
        "Tea",
        "Milk",
      ]),
      createMeal("lunch", [
        "Rice",
        "Roti",
        "Tomato Bhindi Curry",
        "Dal tadka",
        "Curd",
        "Salad",
        "Tomato chutney",
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
        "Chicken Biryani",
        "Paneer Biryani",
        "Veg Gravy",
        "Chicken Gravy",
        "Boondi Raita",
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
        "Idli",
        "Podi Idly Sprouts",
        "Groundnut Chutney",
        "Tomato chutney",
        "Sambar",
        "Bread (Normal/Brown)",
        "Jam",
        "Butter",
        "Coffee",
        "Milk",
      ]),
      createMeal("lunch", [
        "Rice",
        "Kerala rice",
        "Roti",
        "Ivy gourd fry",
        "Olan",
        "Veg Kolhapuri",
        "Pineapple Pachadi",
        "Kondattam",
        "Papad",
        "Curd",
        "Salad",
      ]),
      createMeal("snacks", ["Chivda", "Bread", "Jam", "Butter", "Tea", "Milk"]),
      createMeal("dinner", [
        "Rice",
        "Roti",
        "Brinjal curry",
        "Spicy Dal Tadka",
        "Sambhar",
        "Rice",
        "Rasam",
        "Curd",
        "Salad",
        "chips",
        "Sweet: Ada Payasam",
        "Banana",
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
        "Tea",
        "Milk",
        "Banana",
      ]),
      createMeal("lunch", [
        "Rice",
        "Tomato Rice",
        "Roti",
        "carrot Beans thoran",
        "Avial",
        "Sambar",
        "Salad",
        "curd",
        "Chips",
        "Drink: Buttermilk",
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
        "Boiled eggs",
        "Spicy Tomato Gravy",
        "Dal tadka",
        "Vegetable Kurma",
        "Tomato rasam",
        "Curd",
        "Salad",
        "Sweet:Sweet Rice",
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
        "Coffee",
        "Milk",
      ]),
      createMeal("lunch", [
        "Rice",
        "Roti",
        "Chole curry",
        "Onion Dal Tadka",
        "Cabbage carrot Thoran",
        "Rasam",
        "Fryums",
        "Salad",
        "Curd",
        "Drink: Sweet Lassi",
      ]),
      createMeal("snacks", [
        "Sweetcorn(boiled)",
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
        "Chilli Chicken",
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
        "Vermicelli upma",
        "Vegetable Upma",
        "Sprouts",
        "Groundnut Chutney",
        "Bread (Normal/Brown)",
        "Jam",
        "Butter",
        "Banana",
        "Coffee",
        "Milk",
        "Ragi malt with jaggery",
      ]),
      createMeal("lunch", [
        "Roti",
        "Rice",
        "Sambar",
        "Puliyinchi",
        "Egg Bhurji",
        "Mixed Vegetable Kurma",
        "Curd",
        "Salad",
        "Rasam",
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
        "Rasam",
        "Potato Roast",
        "Onion Daltadka",
        "Kanji",
        "Chammanthi",
        "curd",
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
        "Plain Dosa",
        "Medu vada",
        "Sambar",
        "Coconut Chutney",
        "Bread (Normal/Brown)",
        "Jam",
        "Butter",
        "Tea",
        "Banana",
        "Milk",
      ]),
      createMeal("lunch", [
        "Rice",
        "Roti",
        "Palak Dal tadka",
        "Crunchy Bhindi Fry",
        "Rasam",
        "Papad",
        "Curd",
        "Salad",
        "Drink: Buttermilk",
      ]),
      createMeal("snacks", [
        "Kozhukkatta",
        "Bread",
        "Jam",
        "Butter",
        "Tea",
        "Milk",
      ]),
      createMeal("dinner", [
        "Tawa Pulao",
        "Roti",
        "Chettinad Chicken",
        "Chilli Paneer",
        "Vegetable Raita",
        "Salad",
        "Drink:Lemon juice/Litchi",
      ]),
    ],
  },
  // saturday (6)
  {
    day: 6,
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
        "Tea",
        "Milk",
      ]),
      createMeal("lunch", [
        "Kerala rice",
        "White rice",
        "Jeera Rice",
        "Roti",
        "Pulissery",
        "Potato curry",
        "Mulaku Kondattam",
        "Rajma Curry",
        "Curd",
        "Salad",
      ]),
      createMeal("snacks", [
        "Onion Vada",
        "Steamed kerala banana",
        "Bread",
        "Jam",
        "Butter",
        "Coffee",
        "Milk",
      ]),
      createMeal("dinner", [
        "Rice",
        "Pudina rice",
        "Roti",
        "Mirchi Bajji",
        "Soya granules curry",
        "Beetroot Curry",
        "Palak Dal tadka",
        "Pepper Rasam",
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
