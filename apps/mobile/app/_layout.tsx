import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SqliteProvider } from '../src/infrastructure/sqlite-provider'

export default function RootLayout() {
  return (
    <SqliteProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#1a1a1a' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: '#111' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'TrailDiary' }} />
        <Stack.Screen name="import" options={{ title: 'Import Activity' }} />
        <Stack.Screen name="trail/[id]" options={{ title: 'Trail' }} />
      </Stack>
    </SqliteProvider>
  )
}
