import React from 'react';
import { Tabs } from 'expo-router';
import {
  LayoutDashboard,
  Briefcase,
  PieChart,
  ReceiptIndianRupee,
  UploadCloud,
  Settings,
} from 'lucide-react-native';

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

const TAB_CONFIG = [
  { name: 'index', title: 'Dashboard', Icon: LayoutDashboard },
  { name: 'holdings', title: 'Holdings', Icon: Briefcase },
  { name: 'analytics', title: 'Analytics', Icon: PieChart },
  { name: 'tax', title: 'Tax', Icon: ReceiptIndianRupee },
  { name: 'upload', title: 'Upload', Icon: UploadCloud },
  { name: 'settings', title: 'Settings', Icon: Settings },
] as const;

/**
 * Root tabs navigation layout.
 *
 * @returns React Native tab navigation element
 */
export default function TabsLayout(): React.ReactElement {
  return (
    <Tabs screenOptions={screenOptions}>
      {TAB_CONFIG.map(({ name, title, Icon }) => (
        <Tabs.Screen
          key={name}
          name={name}
          options={{
            title,
            tabBarIcon: ({ color, size }) => <Icon size={size || 22} color={color} />,
          }}
        />
      ))}
    </Tabs>
  );
}
