import { Colors, Radius, Spacing } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'
import type { DayOfWeek } from '@/types'
import * as Haptics from 'expo-haptics'
import { Pressable, StyleSheet, Text, View } from 'react-native'

interface DaySelectorProps {
    selectedDay: DayOfWeek
    onSelect: (day: DayOfWeek) => void
}

const DAYS: { day: DayOfWeek; label: string }[] = [
    { day: 1, label: 'Mon' },
    { day: 2, label: 'Tue' },
    { day: 3, label: 'Wed' },
    { day: 4, label: 'Thu' },
    { day: 5, label: 'Fri' },
]

export function DaySelector({ selectedDay, onSelect }: DaySelectorProps) {
    const colorScheme = useColorScheme()
    const isDark = colorScheme === 'dark'
    const theme = isDark ? Colors.dark : Colors.light

    const handleSelect = (day: DayOfWeek) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        onSelect(day)
    }

    return (
        <View style={styles.container}>
            {DAYS.map(({ day, label }) => {
                const isSelected = day === selectedDay
                const isToday = day === new Date().getDay()

                return (
                    <Pressable
                        key={day}
                        onPress={() => handleSelect(day)}
                        style={[
                            styles.dayBtn,
                            { backgroundColor: isSelected ? theme.text : theme.backgroundSecondary },
                            isToday && !isSelected && { borderColor: theme.text, borderWidth: 1 },
                        ]}
                    >
                        <Text
                            style={[
                                styles.dayText,
                                { color: isSelected ? theme.background : theme.text },
                                !isSelected && !isToday && { color: theme.textSecondary },
                            ]}
                        >
                            {label}
                        </Text>
                    </Pressable>
                )
            })}
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        gap: Spacing.sm,
        paddingVertical: Spacing.sm,
    },
    dayBtn: {
        flex: 1,
        paddingVertical: Spacing.sm,
        borderRadius: Radius.md,
        alignItems: 'center',
    },
    dayText: {
        fontSize: 13,
        fontWeight: '600',
    },
})
