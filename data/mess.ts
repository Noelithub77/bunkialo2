// mess menu data - march 2025

export type MealType = 'breakfast' | 'lunch' | 'snacks' | 'dinner'

export interface Meal {
    type: MealType
    name: string
    items: string[]
    startTime: string
    endTime: string
}

export interface DayMenu {
    day: number // 0=Sun, 1=Mon, etc
    meals: Meal[]
}

export const MEAL_COLORS: Record<MealType, string> = {
    breakfast: '#F59E0B', // amber
    lunch: '#10B981',     // emerald
    snacks: '#8B5CF6',    // violet
    dinner: '#3B82F6',    // blue
}

export const MEAL_TIMES: Record<MealType, { start: string; end: string; name: string }> = {
    breakfast: { start: '07:00', end: '09:45', name: 'Breakfast' },
    lunch: { start: '11:45', end: '14:30', name: 'Lunch' },
    snacks: { start: '16:00', end: '18:00', name: 'Snacks' },
    dinner: { start: '19:00', end: '21:00', name: 'Dinner' },
}

const createMeal = (type: MealType, items: string[]): Meal => ({
    type,
    name: MEAL_TIMES[type].name,
    items,
    startTime: MEAL_TIMES[type].start,
    endTime: MEAL_TIMES[type].end,
})

export const MESS_MENU: DayMenu[] = [
    // sunday (0)
    {
        day: 0,
        meals: [
            createMeal('breakfast', ['Puri Masala', 'Pongal', 'Groundnut Chutney', 'Banana', 'Boiled Egg', 'Sprouts', 'Bread (Normal/Brown)', 'Jam', 'Tea', 'Milk']),
            createMeal('lunch', ['Rice', 'Roti', 'Bhindi Masala Curry', 'Tomato Dal Tadka', 'Curd', 'Salad', 'Coriander Tomato Chutney', 'Chips', 'Sweet Lassi']),
            createMeal('snacks', ['Mirchi Bajji/Cream Bun', 'Bread', 'Jam', 'Butter', 'Tea', 'Milk']),
            createMeal('dinner', ['Chicken Biryani', 'Paneer Biryani', 'Veg Gravy', 'Chicken Gravy', 'Boondi Raita', 'Onion Chilli Raita', 'Papad', 'Salad', 'Rooh Afza']),
        ],
    },
    // monday (1)
    {
        day: 1,
        meals: [
            createMeal('breakfast', ['Vada Pav', 'Puttu', 'Channa Curry', 'Fried Chillies', 'Onions', 'Green Chutney', 'Red Powdered Chutney', 'Bread (Normal/Brown)', 'Jam', 'Butter', 'Tea', 'Milk', 'Banana']),
            createMeal('lunch', ['Jeera Rice', 'Rice', 'Roti', 'Potato Curry', 'Beetroot Dry', 'Mulaku Kondattam', 'Rajma Curry', 'Fryums', 'Pulissery', 'Curd', 'Salad', 'Seasonal Fruit']),
            createMeal('snacks', ['Bhelpuri', 'Bread', 'Jam', 'Butter', 'Tea', 'Milk']),
            createMeal('dinner', ['Rice', 'Roti', 'Soya Chunk Fry (small)', 'Palak Dal Tadka', 'Cabbage Chutney', 'Pepper Rasam', 'Chips', 'Curd', 'Salad', 'Ada Payasam']),
        ],
    },
    // tuesday (2)
    {
        day: 2,
        meals: [
            createMeal('breakfast', ['Idli', 'Masala Idli', 'Punugulu', 'Sambar', 'Groundnut Chutney', 'Tomato Chutney', 'Bread (Normal/Brown)', 'Jam', 'Butter', 'Coffee', 'Milk']),
            createMeal('lunch', ['Rice', 'Roti', 'Chole Curry', 'Onion Dal Tadka', 'Ivy Gourd Chutney', 'Salad', 'Curd', 'Sweet Lassi']),
            createMeal('snacks', ['Masala Puri Chaat', 'Bread', 'Jam', 'Butter', 'Tea', 'Milk']),
            createMeal('dinner', ['Rice', 'Roti', 'Egg Curry', 'Dal Tadka', 'Cabbage Carrot Thoran', 'Vanpayar Aloo Curry', 'Peanut Rasam', 'Curd', 'Papad', 'Salad', 'Pineapple Drink']),
        ],
    },
    // wednesday (3)
    {
        day: 3,
        meals: [
            createMeal('breakfast', ['Masala Uthappam', 'Medu Vada', 'Sambar', 'Coconut Chutney', 'Bread (Normal/Brown)', 'Jam', 'Butter', 'Coffee', 'Banana', 'Milk']),
            createMeal('lunch', ['Rice', 'Roti', 'Palak Dal Tadka', 'Crunchy Bhindi Fry', 'Rasam', 'Papad', 'Curd', 'Salad', 'Banana', 'Buttermilk']),
            createMeal('snacks', ['Peanuts Chaat', 'Bread', 'Jam', 'Butter', 'Tea', 'Milk']),
            createMeal('dinner', ['Fried Rice', 'Roti', 'Kadai Paneer', 'Chilli Chicken', 'Onion Chilli Raita', 'Passion Fruit Drink']),
        ],
    },
    // thursday (4)
    {
        day: 4,
        meals: [
            createMeal('breakfast', ['Pav Bhaji', 'Lemons', 'Onions', 'Uggani (Puffed Rice)', 'Roasted Chana Podi', 'Bread (Normal/Brown)', 'Jam', 'Butter', 'Banana', 'Tea', 'Milk']),
            createMeal('lunch', ['Roti', 'Rice', 'Egg Bhurji', 'Mixed Vegetable Kurma', 'Tomato Dal Tadka', 'Chips', 'Curd', 'Salad', 'Rasam', 'Buttermilk']),
            createMeal('snacks', ['Veg Noodles', 'Bread', 'Jam', 'Butter', 'Tea', 'Milk']),
            createMeal('dinner', ['Rice', 'Roti', 'Raw Banana Stir Fry', 'Radish Chutney', 'Spicy Dal Tadka', 'Rasam', 'Chips', 'Curd', 'Salad', 'Vermicelli Payasam']),
        ],
    },
    // friday (5)
    {
        day: 5,
        meals: [
            createMeal('breakfast', ['Idli', 'Masala Idli', 'Medu Vada', 'Groundnut Chutney', 'Tomato Chutney', 'Sambar', 'Bread (Normal/Brown)', 'Jam', 'Butter', 'Coffee', 'Milk']),
            createMeal('lunch', ['Rice', 'Tomato Rice', 'Roti', 'Beans and Carrot Thoran', 'Sambar', 'Salad', 'Curd', 'Chips', 'Chana Masala', 'Seasonal Fruits']),
            createMeal('snacks', ['Kozhukkatta', 'Bread', 'Jam', 'Butter', 'Tea', 'Milk']),
            createMeal('dinner', ['Rice', 'Pulao', 'Roti', 'Chicken Masala', 'Paneer Masala', 'Curd', 'Vegetable Raita', 'Salad', 'Lemon Sharbat']),
        ],
    },
    // saturday (6)
    {
        day: 6,
        meals: [
            createMeal('breakfast', ['Normal Upma/Vermicelli Upma', 'Sprouts', 'Groundnut Chutney', 'Mango Pickle', 'Bread (Normal/Brown)', 'Jam', 'Butter', 'Banana', 'Coffee', 'Milk']),
            createMeal('lunch', ['Rice', 'Roti', 'Kerala Rice', 'Ivy Gourd Fry', 'Onam Kootukari', 'Parippu Dal', 'Beetroot Pachadi', 'Bitter Gourd Kondattam', 'Papad', 'Curd', 'Salad', 'Buttermilk']),
            createMeal('snacks', ['Onion Vada', 'Bread', 'Jam', 'Butter', 'Tea', 'Milk']),
            createMeal('dinner', ['Roti', 'Rice', 'Rasam', 'Potato Roast', 'Horse Gram Chutney', 'Onion Dal Tadka', 'Curd', 'Salad', 'Fryums', 'Lychee Drink']),
        ],
    },
]

// get menu for a specific day
export const getMenuForDay = (dayOfWeek: number): DayMenu | undefined => {
    return MESS_MENU.find(menu => menu.day === dayOfWeek)
}

// get current or next meal based on time
export const getCurrentMeal = (now: Date): { current: Meal | null; next: Meal | null } => {
    const dayMenu = getMenuForDay(now.getDay())
    if (!dayMenu) return { current: null, next: null }

    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

    let current: Meal | null = null
    let next: Meal | null = null

    for (const meal of dayMenu.meals) {
        if (currentTime >= meal.startTime && currentTime < meal.endTime) {
            current = meal
        } else if (currentTime < meal.startTime && !next) {
            next = meal
        }
    }

    // if no next meal today, get first meal of tomorrow
    if (!current && !next) {
        const tomorrowMenu = getMenuForDay((now.getDay() + 1) % 7)
        next = tomorrowMenu?.meals[0] || null
    }

    return { current, next }
}

// get all meals for carousel with nearby context
export const getNearbyMeals = (now: Date): { meals: Meal[]; initialIndex: number } => {
    const dayMenu = getMenuForDay(now.getDay())
    if (!dayMenu) return { meals: [], initialIndex: 0 }

    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

    let initialIndex = 0
    for (let i = 0; i < dayMenu.meals.length; i++) {
        const meal = dayMenu.meals[i]
        if (currentTime >= meal.startTime && currentTime < meal.endTime) {
            initialIndex = i
            break
        } else if (currentTime < meal.startTime) {
            initialIndex = i
            break
        } else {
            initialIndex = i
        }
    }

    return { meals: dayMenu.meals, initialIndex }
}
