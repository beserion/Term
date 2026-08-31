import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { AuthStack } from './AuthStack';
import { InventoryStack } from './InventoryStack';
import { useAuthStore } from '../store/authStore';
import { Colors } from '../theme';
import { useSettingsStore } from '../store/settingsStore';

export function AppNavigator() {
  const { isAuthenticated, isLoading, initialize } = useAuthStore();
  const { clearActiveWarehouse, clearActivePrinter } = useSettingsStore();

  useEffect(() => {
    initialize();
    // Program her başlatıldığında aktif depo ve yazıcıyı sıfırla
    clearActiveWarehouse();
    clearActivePrinter();
  }, []);

  return (
    <NavigationContainer>
      {isAuthenticated ? <InventoryStack /> : <AuthStack />}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
});
