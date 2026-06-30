import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ShipmentsListScreen } from '../screens/ShipmentsListScreen';
import { ShipmentDetailScreen } from '../screens/ShipmentDetailScreen';

const Stack = createNativeStackNavigator();

export function ShippingStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ShipmentsList" component={ShipmentsListScreen} />
      <Stack.Screen name="ShipmentDetail" component={ShipmentDetailScreen} />
    </Stack.Navigator>
  );
}
