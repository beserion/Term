import React, { useRef } from 'react';
import { Pressable, Animated, ViewStyle, PressableProps } from 'react-native';

interface ScalePressableProps extends PressableProps {
  children: React.ReactNode;
  style?: ViewStyle | any;
  activeScale?: number;
}

export function ScalePressable({
  children,
  style,
  activeScale = 0.96,
  onPressIn,
  onPressOut,
  ...props
}: ScalePressableProps) {
  const scaleValue = useRef(new Animated.Value(1)).current;

  const handlePressIn = (event: any) => {
    Animated.spring(scaleValue, {
      toValue: activeScale,
      useNativeDriver: true,
      tension: 150,
      friction: 8,
    }).start();
    if (onPressIn) onPressIn(event);
  };

  const handlePressOut = (event: any) => {
    Animated.spring(scaleValue, {
      toValue: 1,
      useNativeDriver: true,
      tension: 150,
      friction: 5,
    }).start();
    if (onPressOut) onPressOut(event);
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      {...props}
    >
      <Animated.View style={[
        style,
        { transform: [{ scale: scaleValue }] }
      ]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
