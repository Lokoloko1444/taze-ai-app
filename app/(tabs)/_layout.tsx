import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from 'components/haptic-tab';
import { IconSymbol } from 'components/ui/icon-symbol';
import { Colors } from 'constants/theme';
import { useColorScheme } from 'hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
          tabBarInactiveTintColor: Colors[colorScheme ?? 'light'].tabIconDefault,
          headerShown: false,
          tabBarHideOnKeyboard: true,
          tabBarItemStyle: {
            marginVertical: 6,
            borderRadius: 18,
          },
          tabBarLabelStyle: {
            fontSize: 10.5,
            fontWeight: '600',
            letterSpacing: 0.3,
            marginBottom: 1,
          },
          tabBarStyle: {
            height: 76,
            marginHorizontal: 14,
            marginBottom: 12,
            borderRadius: 24,
            paddingTop: 10,
            paddingBottom: 12,
            borderTopWidth: 0,
            borderColor: 'rgba(15, 23, 42, 0.08)',
            backgroundColor: 'rgba(255,255,255,0.94)',
            shadowColor: '#07111f',
            shadowOpacity: 0.12,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 10 },
            elevation: 10,
            boxShadow: '0px 18px 34px rgba(15, 23, 42, 0.12)',
          },
          tabBarIconStyle: {
            marginTop: 2,
          },
          tabBarButton: HapticTab,
        }}>
        <Tabs.Screen
          name="index"
          options={{
            title: 'Start',
            tabBarIcon: ({ color }) => <IconSymbol size={24} name="house.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="scan"
          options={{
            title: 'Scan',
            tabBarIcon: ({ color }) => <IconSymbol size={24} name="camera.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="explore"
          options={{
            title: 'Voorraad',
            tabBarIcon: ({ color }) => <IconSymbol size={24} name="chart.bar.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="trace"
          options={{
            title: 'Trace',
            tabBarIcon: ({ color }) => (
              <IconSymbol size={24} name="list.bullet.rectangle.fill" color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="account"
          options={{
            title: 'Account',
            tabBarIcon: ({ color }) => <IconSymbol size={24} name="person.fill" color={color} />,
          }}
        />
        <Tabs.Screen
          name="hub"
          options={{
            href: null,
          }}
        />
      </Tabs>
    </>
  );
}

