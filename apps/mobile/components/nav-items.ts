import type { ComponentType } from "react";
import {
  House,
  MessageCircle,
  Receipt,
  Calendar,
  Package,
  Settings,
} from "lucide-react-native";

type IconType = ComponentType<{ size?: number; color?: string }>;

export type NavItem = {
  name: string;
  label: string;
  route: string;
  icon: IconType;
};

// Single source of truth for mobile destinations. The bottom bar renders PINNED;
// the drawer renders the full list. route is a plain string so we can compare it
// against usePathname(); it is cast to Href at the router.push call site.
export const NAV_ITEMS: NavItem[] = [
  { name: "home", label: "Home", route: "/home", icon: House },
  { name: "conversations", label: "Chats", route: "/conversations", icon: MessageCircle },
  { name: "orders", label: "Orders", route: "/orders", icon: Receipt },
  { name: "bookings", label: "Bookings", route: "/bookings", icon: Calendar },
  { name: "inventory", label: "Inventory", route: "/inventory", icon: Package },
  { name: "settings", label: "Settings", route: "/settings", icon: Settings },
];

export const PINNED: string[] = ["home", "conversations", "orders"];
