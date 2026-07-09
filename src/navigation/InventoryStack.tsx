import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DashboardScreen } from '../screens/DashboardScreen';
import { ProductCheckScreen } from '../screens/ProductCheckScreen';
import { StockDecreaseScreen } from '../screens/StockDecreaseScreen';
import { StockIncreaseScreen } from '../screens/StockIncreaseScreen';
import { StockTransferScreen } from '../screens/StockTransferScreen';
import { CycleCountScreen } from '../screens/CycleCountScreen';
import { LabelPrintScreen } from '../screens/LabelPrintScreen';
import { BarcodeLinkScreen } from '../screens/BarcodeLinkScreen';

const Stack = createNativeStackNavigator();

export function InventoryStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="ProductCheck" component={ProductCheckScreen} />
      <Stack.Screen name="StockDecrease" component={StockDecreaseScreen} />
      <Stack.Screen name="StockIncrease" component={StockIncreaseScreen} />
      <Stack.Screen name="StockTransfer" component={StockTransferScreen} />
      <Stack.Screen name="CycleCount" component={CycleCountScreen} />
      <Stack.Screen name="LabelPrint" component={LabelPrintScreen} />
      <Stack.Screen name="BarcodeLink" component={BarcodeLinkScreen} />
    </Stack.Navigator>
  );
}


