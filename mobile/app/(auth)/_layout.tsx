import React from 'react';
import { Stack } from 'expo-router';

/**
 * Stack layout for authentication and pairing screens.
 */
export default function AuthLayout(): React.ReactElement {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#09090b' },
      }}
    />
  );
}
