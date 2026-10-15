import { BookOpen, Church, HandHeart, Handshake, Leaf, Sparkles, type LucideIcon } from "lucide-react";

// Icon for each challenge category (shown on covers without a picture).
const ICONS: Record<string, LucideIcon> = {
  prayer: HandHeart,
  fasting: Leaf,
  scripture: BookOpen,
  service: Handshake,
  worship: Church,
  other: Sparkles,
};

export function challengeIcon(category: string): LucideIcon {
  return ICONS[category] ?? Sparkles;
}
