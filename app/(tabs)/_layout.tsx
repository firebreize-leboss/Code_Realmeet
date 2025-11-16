
import React from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import FloatingTabBar, { TabBarItem } from '@/components/FloatingTabBar';

export default function TabLayout() {
  const tabs: TabBarItem[] = [
    {
      name: 'profile',
      route: '/(tabs)/profile',
      icon: 'person.fill',
      label: 'Profile',
    },
    {
      name: 'browse',
      route: '/(tabs)/browse',
      icon: 'square.grid.2x2.fill',
      label: 'Browse',
    },
    {
      name: 'activity',
      route: '/(tabs)/activity',
      icon: 'calendar',
      label: 'Activity',
    },
    {
      name: 'category',
      route: '/(tabs)/category',
      icon: 'square.stack.3d.up.fill',
      label: 'Category',
    },
    {
      name: 'chat',
      route: '/(tabs)/chat',
      icon: 'message.fill',
      label: 'Chat',
    },
  ];

  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'none',
        }}
      >
        <Stack.Screen name="profile" />
        <Stack.Screen name="browse" />
        <Stack.Screen name="activity" />
        <Stack.Screen name="category" />
        <Stack.Screen name="chat" />
      </Stack>
      <FloatingTabBar tabs={tabs} containerWidth={360} />
    </>
  );
}
