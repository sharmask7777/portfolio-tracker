import React from 'react';
import { Tabs } from 'expo-router';
import { LayoutDashboard, PieChart, UploadCloud, Settings } from 'lucide-react-native';

const screenOptions = {
  headerShown: false,
  tabBarStyle: {
    backgroundColor: '#18181b',
    borderTopColor: '#27272a',
    height: 60,
    paddingBottom: 8,
    paddingTop: 8,
  },
  tabBarActiveTintColor: '#3b82f6',
  tabBarInactiveTintColor: '#71717a',
  tabBarLabelStyle: {
    fontSize: 12,
    fontWeight: '500' as const,
  },
};

export default function TabsLayout(): React.ReactElement {
  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <LayoutDashboard size={size || 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="holdings"
        options={{
          title: 'Holdings',
          tabBarIcon: ({ color, size }) => (
            <PieChart size={size || 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="upload"
        options={{
          title: 'Upload',
          tabBarIcon: ({ color, size }) => (
            <UploadCloud size={size || 22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color, size }) => (
            <Settings size={size || 22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
