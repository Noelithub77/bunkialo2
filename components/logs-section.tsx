import { Colors, Radius, Spacing } from '@/constants/theme'
import { useColorScheme } from '@/hooks/use-color-scheme'
import type { DashboardLog } from '@/types'
import { Ionicons } from '@expo/vector-icons'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

type LogsSectionProps = {
    logs: DashboardLog[]
    onClear: () => void
}

const formatLogTime = (timestamp: number): string => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
    })
}

const getLogColor = (type: DashboardLog['type']): string => {
    switch (type) {
        case 'success': return Colors.status.success
        case 'error': return Colors.status.danger
        default: return Colors.status.info
    }
}

export const LogsSection = ({ logs, onClear }: LogsSectionProps) => {
    const colorScheme = useColorScheme()
    const isDark = colorScheme === 'dark'
    const theme = isDark ? Colors.dark : Colors.light
    const [expanded, setExpanded] = useState(false)

    return (
        <View style={[styles.container, { borderColor: theme.border }]}>
            <Pressable
                style={styles.header}
                onPress={() => setExpanded(!expanded)}
            >
                <View style={styles.headerLeft}>
                    <Ionicons name="list-outline" size={18} color={theme.textSecondary} />
                    <Text style={[styles.headerText, { color: theme.text }]}>
                        Sync Logs ({logs.length})
                    </Text>
                </View>
                <Ionicons
                    name={expanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={theme.textSecondary}
                />
            </Pressable>

            {expanded && (
                <View style={styles.content}>
                    {logs.length === 0 ? (
                        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                            No logs yet
                        </Text>
                    ) : (
                        <>
                            {logs.slice(0, 10).map((log) => (
                                <View key={log.id} style={styles.logRow}>
                                    <View style={[styles.logDot, { backgroundColor: getLogColor(log.type) }]} />
                                    <Text style={[styles.logTime, { color: theme.textSecondary }]}>
                                        {formatLogTime(log.timestamp)}
                                    </Text>
                                    <Text style={[styles.logMessage, { color: theme.text }]} numberOfLines={1}>
                                        {log.message}
                                    </Text>
                                </View>
                            ))}
                            {logs.length > 0 && (
                                <Pressable style={styles.clearButton} onPress={onClear}>
                                    <Text style={[styles.clearText, { color: Colors.status.danger }]}>
                                        Clear Logs
                                    </Text>
                                </Pressable>
                            )}
                        </>
                    )}
                </View>
            )}
        </View>
    )
}

const styles = StyleSheet.create({
    container: {
        borderRadius: Radius.md,
        borderWidth: 1,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: Spacing.md,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    headerText: {
        fontSize: 14,
        fontWeight: '500',
    },
    content: {
        paddingHorizontal: Spacing.md,
        paddingBottom: Spacing.md,
        gap: Spacing.sm,
    },
    logRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
    },
    logDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    logTime: {
        fontSize: 11,
        fontWeight: '500',
        width: 60,
    },
    logMessage: {
        flex: 1,
        fontSize: 12,
    },
    emptyText: {
        fontSize: 12,
        textAlign: 'center',
    },
    clearButton: {
        alignItems: 'center',
        paddingTop: Spacing.sm,
    },
    clearText: {
        fontSize: 12,
        fontWeight: '500',
    },
})
