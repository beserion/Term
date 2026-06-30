import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ProductCheckScreen } from '../screens/ProductCheckScreen';
import { StockDecreaseScreen } from '../screens/StockDecreaseScreen';
import { StockIncreaseScreen } from '../screens/StockIncreaseScreen';

const Stack = createNativeStackNavigator();

export function InventoryStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="ProductCheck" component={ProductCheckScreen} />
      <Stack.Screen name="StockDecrease" component={StockDecreaseScreen} />
      <Stack.Screen name="StockIncrease" component={StockIncreaseScreen} />
    </Stack.Navigator>
  );
}
