import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Montserrat_400Regular, Montserrat_500Medium, Montserrat_600SemiBold, Montserrat_700Bold } from '@expo-google-fonts/montserrat';
import { AppNavigator } from './src/navigation/AppNavigator';
import { Toast, LoadingOverlay } from './src/components/Toast';
import { RedScreenLock } from './src/components/RedScreenLock';

export default function App() {
  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AppNavigator />
      <Toast />
      <LoadingOverlay />
      <RedScreenLock />
    </SafeAreaProvider>
  );
}
