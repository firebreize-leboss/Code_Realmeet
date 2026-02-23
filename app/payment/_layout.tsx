// app/payment/_layout.tsx
// Layout pour le flow de paiement - Stack navigator sans header (headers gérés manuellement)

import { Stack } from 'expo-router';

export default function PaymentLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="select-method" />
      <Stack.Screen name="card-form" />
      <Stack.Screen name="confirmation" />
    </Stack>
  );
}
