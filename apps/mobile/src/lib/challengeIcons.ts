import type { Ionicons } from "@expo/vector-icons";

// Icon for each challenge category (shown on covers without a picture).
const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  prayer: "heart-outline",
  fasting: "leaf-outline",
  scripture: "book-outline",
  service: "people-outline",
  worship: "musical-notes-outline",
  other: "sparkles-outline",
};

export function challengeIcon(category: string): keyof typeof Ionicons.glyphMap {
  return ICONS[category] ?? ICONS.other;
}
