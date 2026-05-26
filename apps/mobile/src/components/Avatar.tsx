import React from "react";
import { View, Text, Image, StyleSheet } from "react-native";

interface AvatarProps {
  uri?: string | null;
  name?: string | null;
  size?: number;
  bgColor?: string;
  textColor?: string;
}

export function Avatar({
  uri,
  name,
  size = 40,
  bgColor = "#EEF1F8",
  textColor = "#1B2E6B",
}: AvatarProps) {
  const initial = (name ?? "?")[0].toUpperCase();
  const fontSize = Math.round(size * 0.38);
  const radius   = size / 2;

  const containerStyle = {
    width: size,
    height: size,
    borderRadius: radius,
    backgroundColor: bgColor,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    overflow: "hidden" as const,
  };

  return (
    <View style={containerStyle}>
      {uri ? (
        <Image source={{ uri }} style={{ width: size, height: size }} />
      ) : (
        <Text style={{ fontSize, fontWeight: "700", color: textColor }}>{initial}</Text>
      )}
    </View>
  );
}
