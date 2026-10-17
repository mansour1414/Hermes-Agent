import {
  Activity,
  Bot,
  Boxes,
  Brain,
  Compass,
  Cpu,
  FolderKanban,
  Gauge,
  MessagesSquare,
  MonitorCog,
  Puzzle,
  Server,
  Settings,
  Share2,
  Sparkles,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { TranslationKey } from "@/locales/en";

export interface NavItem {
  id: string;
  path: string;
  labelKey: TranslationKey;
  icon: LucideIcon;
  section: "workspace" | "intelligence" | "capabilities" | "system";
  keywords?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", path: "/", labelKey: "nav.dashboard", icon: Gauge, section: "workspace" },
  { id: "chats", path: "/chats", labelKey: "nav.chats", icon: MessagesSquare, section: "workspace" },
  { id: "projects", path: "/projects", labelKey: "nav.projects", icon: FolderKanban, section: "workspace" },
  { id: "models", path: "/models", labelKey: "nav.models", icon: Cpu, section: "intelligence" },
  { id: "providers", path: "/providers", labelKey: "nav.providers", icon: Share2, section: "intelligence" },
  { id: "mcp", path: "/mcp", labelKey: "nav.mcp", icon: Server, section: "intelligence" },
  { id: "skills", path: "/skills", labelKey: "nav.skills", icon: Sparkles, section: "intelligence" },
  { id: "tools", path: "/tools", labelKey: "nav.tools", icon: Wrench, section: "capabilities" },
  { id: "browser", path: "/browser", labelKey: "nav.browser", icon: Compass, section: "capabilities" },
  { id: "computer-use", path: "/computer-use", labelKey: "nav.computerUse", icon: MonitorCog, section: "capabilities" },
  { id: "files", path: "/files", labelKey: "nav.files", icon: FolderKanban, section: "capabilities" },
  { id: "memory", path: "/memory", labelKey: "nav.memory", icon: Brain, section: "capabilities" },
  { id: "automations", path: "/automations", labelKey: "nav.automations", icon: Boxes, section: "system" },
  { id: "integrations", path: "/integrations", labelKey: "nav.integrations", icon: Puzzle, section: "system" },
  { id: "activity", path: "/activity", labelKey: "nav.activity", icon: Activity, section: "system" },
  { id: "settings", path: "/settings", labelKey: "nav.settings", icon: Settings, section: "system" },
];

export const NAV_SECTIONS: {
  id: NavItem["section"];
  labelKey: TranslationKey;
  icon: LucideIcon;
}[] = [
  { id: "workspace", labelKey: "nav.sectionWorkspace", icon: Gauge },
  { id: "intelligence", labelKey: "nav.sectionIntelligence", icon: Bot },
  { id: "capabilities", labelKey: "nav.sectionCapabilities", icon: Wrench },
  { id: "system", labelKey: "nav.sectionSystem", icon: Settings },
];
