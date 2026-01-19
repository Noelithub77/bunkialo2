interface CourseCredit {
    code: string
    credits: number
}

const COURSE_CREDITS: CourseCredit[] = [
    { code: "IMA221", credits: 4 },
    { code: "ICS221", credits: 4 },
    { code: "ICS222", credits: 4 },
    { code: "ICS223", credits: 4 },
    { code: "ICS224", credits: 4 },
    { code: "ICS225", credits: 2 },
    { code: "IHS221", credits: 1 },
    { code: "IHS222", credits: 1 },
]

// fuzzy match - case-insensitive, handles partial matches
export const findCreditsByCode = (courseCode: string): number | null => {
    if (!courseCode) return null

    const normalized = courseCode.toUpperCase().trim()

    // exact match first
    const exact = COURSE_CREDITS.find((c) => c.code.toUpperCase() === normalized)
    if (exact) return exact.credits

    // partial match - check if course code contains the known code or vice versa
    const partial = COURSE_CREDITS.find(
        (c) =>
            normalized.includes(c.code.toUpperCase()) ||
            c.code.toUpperCase().includes(normalized)
    )
    if (partial) return partial.credits

    return null
}
