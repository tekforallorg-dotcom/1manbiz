import type { ComponentType } from "react";
import {
  House,
  MessageCircle,
  Receipt,
  Calendar,
  Package,
  Users,
  FileText,
  LineChart,
  Wallet,
  Settings,
} from "lucide-react-native";
import { BizBotIcon } from "./bizbot-mark";

type IconType = ComponentType<{ size?: number; color?: string }>;

export type NavItem = {
  name: string;
  label: string;
  route: string;
  icon: IconType;
};

export const NAV_ITEMS: NavItem[] = [
  { name: "home", label: "Home", route: "/home", icon: House },
  { name: "conversations", label: "Chats", route: "/conversations", icon: MessageCircle },
  { name: "orders", label: "Orders", route: "/orders", icon: Receipt },
  { name: "bookings", label: "Bookings", route: "/bookings", icon: Calendar },
  { name: "inventory", label: "Inventory", route: "/inventory", icon: Package },
  { name: "customers", label: "Customers", route: "/customers", icon: Users },
  { name: "receipts", label: "Receipts", route: "/receipts", icon: FileText },
  { name: "money", label: "Money", route: "/money", icon: Wallet },
  { name: "insights", label: "Insights", route: "/insights", icon: LineChart },
  { name: "bizbot", label: "BizBot", route: "/bizbot", icon: BizBotIcon },
  { name: "settings", label: "Settings", route: "/settings", icon: Settings },
];

export const PINNED: string[] = ["home", "conversations", "orders"];
