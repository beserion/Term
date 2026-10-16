import React, { useRef, useState, useEffect } from 'react';
import {
  ScrollView,
  ScrollViewProps,
  Keyboard,
  Platform,
  StyleSheet,
  ViewStyle,
  EmitterSubscription,
} from 'react-native';

interface SafeKeyboardScrollViewProps extends ScrollViewProps {
  extraHeight?: number;
}

export const SafeKeyboardScrollView = React.forwardRef<ScrollView, SafeKeyboardScrollViewProps>(
  ({ children, contentContainerStyle, extraHeight = 80, ...props }, ref) => {
    const internalRef = useRef<ScrollView>(null);
    const scrollRef = (ref as React.RefObject<ScrollView>) || internalRef;
    const [keyboardPadding, setKeyboardPadding] = useState(0);

    useEffect(() => {
      const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
      const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

      const showSub: EmitterSubscription = Keyboard.addListener(showEvent, (e) => {
        const height = e.endCoordinates ? e.endCoordinates.height : 260;
        setKeyboardPadding(height + extraHeight);
      });

      const hideSub: EmitterSubscription = Keyboard.addListener(hideEvent, () => {
        setKeyboardPadding(0);
      });

      return () => {
        showSub.remove();
        hideSub.remove();
      };
    }, [extraHeight]);

    // Flat combined style
    const flattenedContainer = StyleSheet.flatten(contentContainerStyle) || {};
    const basePaddingBottom = typeof flattenedContainer.paddingBottom === 'number'
      ? flattenedContainer.paddingBottom
      : 24;

    const dynamicContainerStyle: ViewStyle = {
      ...flattenedContainer,
      paddingBottom: basePaddingBottom + keyboardPadding,
    };

    return (
      <ScrollView
        ref={scrollRef}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={dynamicContainerStyle}
        {...props}
      >
        {children}
      </ScrollView>
    );
  }
);

SafeKeyboardScrollView.displayName = 'SafeKeyboardScrollView';
