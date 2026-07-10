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
import { QuickSetupScreen } from '../screens/QuickSetupScreen';
import { ReceivingStack } from './ReceivingStack';
import { ShippingStack } from './ShippingStack';
import { SettingsScreen } from '../screens/SettingsScreen';

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
      <Stack.Screen name="QuickSetup" component={QuickSetupScreen} />
      <Stack.Screen name="ReceivingStack" component={ReceivingStack} />
      <Stack.Screen name="ShippingStack" component={ShippingStack} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}


