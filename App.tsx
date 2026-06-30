import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { Toast, LoadingOverlay } from './src/components/Toast';

export default function App() {
  return (
    <SafeAreaProvider>
      <AppNavigator />
      <Toast />
      <LoadingOverlay />
    </SafeAreaProvider>
  );
}
