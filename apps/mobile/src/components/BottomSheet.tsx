import React, { useEffect, useRef } from "react";
import {
  View, Modal, TouchableOpacity, Animated, StyleSheet,
  Dimensions, KeyboardAvoidingView, Platform, ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { themedStyles } from "../theme";

interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  height?: number;
}

const SCREEN_H = Dimensions.get("window").height;

export function BottomSheet({ visible, onClose, children, height = SCREEN_H * 0.75 }: BottomSheetProps) {
  const translateY = useRef(new Animated.Value(height)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 4,
        speed: 16,
      }).start();
    } else {
      Animated.timing(translateY, {
        toValue: height,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Animated.View
        style={[styles.backdrop, { opacity: translateY.interpolate({ inputRange: [0, height], outputRange: [1, 0], extrapolate: "clamp" }) }]}
      >
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />
      </Animated.View>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        pointerEvents="box-none"
      >
        <Animated.View
          style={[
            styles.sheet,
            { height, transform: [{ translateY }] },
          ]}
        >
          <View style={styles.handle} />
          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.content, { paddingBottom: 40 + insets.bottom }]}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = themedStyles({
  backdrop:     { ...StyleSheet.absoluteFill, backgroundColor: "rgba(0,0,0,0.45)" },
  keyboardView: { flex: 1, justifyContent: "flex-end", pointerEvents: "box-none" } as any,
  sheet:        { backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden", paddingHorizontal: 20 },
  handle:       { width: 36, height: 4, backgroundColor: "#E5E7EB", borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 16 },
  content:      { paddingBottom: 40 },
});
