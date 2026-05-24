import {
  Utensils,
  Car,
  ShoppingBag,
  Gift,
  Heart,
  Receipt,
  Briefcase,
  CircleDot,
} from "lucide-react";
import * as React from "react";

export const iconMap: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  utensils: Utensils,
  car: Car,
  "shopping-bag": ShoppingBag,
  "party-popper": Gift,
  "heart-pulse": Heart,
  receipt: Receipt,
  wallet: Briefcase,
  gift: Gift,
  "circle-dashed": CircleDot,
};
