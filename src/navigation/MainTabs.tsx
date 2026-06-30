import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { InventoryStack } from './InventoryStack';
import { ReceivingStack } from './ReceivingStack';
import { ShippingStack } from './ShippingStack';
import { SettingsScreen } from '../screens/SettingsScreen';
import { Colors, Typography, Shadow } from '../theme';

const Tab = createBottomTabNavigator();

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopWidth: 1,
          borderTopColor: Colors.outlineVariant,
          height: 64,
          paddingBottom: 8,
          paddingTop: 4,
          ...Shadow.nav,
        },
        tabBarActiveTintColor: Colors.onSecondaryContainer,
        tabBarInactiveTintColor: Colors.onSurfaceVariant,
        tabBarLabelStyle: {
          ...Typography.labelMd,
          fontSize: 11,
        },
        tabBarItemStyle: {
          borderRadius: 12,
          marginHorizontal: 4,
        },
      }}
    >
      <Tab.Screen
        name="InventoryTab"
        component={InventoryStack}
        options={{
          tabBarLabel: 'Envanter',
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'package-variant-closed' : 'package-variant'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="ReceivingTab"
        component={ReceivingStack}
        options={{
          tabBarLabel: 'Mal Kabul',
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'package-down' : 'package-down'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="ShippingTab"
        component={ShippingStack}
        options={{
          tabBarLabel: 'Sevkiyat',
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'truck-delivery' : 'truck-delivery-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsScreen}
        options={{
          tabBarLabel: 'Ayarlar',
          tabBarIcon: ({ color, focused }) => (
            <MaterialCommunityIcons
              name={focused ? 'cog' : 'cog-outline'}
              size={24}
              color={color}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}
