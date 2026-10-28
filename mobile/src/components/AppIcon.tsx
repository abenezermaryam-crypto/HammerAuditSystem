import React from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Eye,
  EyeOff,
  FileText,
  Home,
  Landmark,
  LogOut,
  LockKeyhole,
  Menu,
  Plus,
  ShieldCheck,
  Settings,
  Store,
  TrendingUp,
  Users,
  Wallet,
  X,
  Mail,
  Phone,
  KeyRound,
  type LucideIcon,
} from 'lucide-react-native';

const icons = {
  activity: Activity,
  alert: AlertTriangle,
  back: ArrowLeft,
  banknote: Banknote,
  calendar: CalendarDays,
  check: CheckCircle2,
  clipboard: ClipboardList,
  eye: Eye,
  eyeOff: EyeOff,
  expense: FileText,
  home: Home,
  income: Plus,
  landmark: Landmark,
  logout: LogOut,
  lock: LockKeyhole,
  menu: Menu,
  shield: ShieldCheck,
  settings: Settings,
  store: Store,
  trend: TrendingUp,
  users: Users,
  wallet: Wallet,
  close: X,
  mail: Mail,
  phone: Phone,
  key: KeyRound,
} satisfies Record<string, LucideIcon>;

export type AppIconName = keyof typeof icons;

export const AppIcon = ({
  name,
  size = 18,
  color = '#64748B',
  accessibilityLabel,
}: {
  name: AppIconName;
  size?: number;
  color?: string;
  accessibilityLabel?: string;
}) => {
  const Icon = icons[name];
  return <Icon size={size} color={color} accessibilityLabel={accessibilityLabel} />;
};
