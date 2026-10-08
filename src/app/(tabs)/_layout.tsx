import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';

import { colors } from '../../components/theme';
import type { IconName } from '../../components/ui';

function tabIcon(name: IconName) {
  return ({ color, size }: { color: ColorValue; size: number }) => (
    <Ionicons name={name} color={color} size={size} />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        headerTitleStyle: { color: colors.text },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Heute', tabBarIcon: tabIcon('home') }} />
      <Tabs.Screen
        name="nutrition"
        options={{ title: 'Ernährung', tabBarIcon: tabIcon('nutrition') }}
      />
      <Tabs.Screen
        name="activities"
        options={{ title: 'Aktivität', tabBarIcon: tabIcon('flame') }}
      />
      <Tabs.Screen
        name="exercises"
        options={{ title: 'Übungen', tabBarIcon: tabIcon('barbell') }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Einstellungen', tabBarIcon: tabIcon('settings') }}
      />
    </Tabs>
  );
}
