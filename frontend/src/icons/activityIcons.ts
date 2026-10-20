import {
  Baby,
  Beer,
  Bell,
  Bike,
  BookOpen,
  Briefcase,
  Cake,
  Calendar,
  Camera,
  Car,
  Church,
  Coffee,
  Dog,
  Dumbbell,
  Film,
  Flower2,
  Gamepad2,
  Gift,
  Globe,
  GraduationCap,
  Handshake,
  Heart,
  House,
  Key,
  type LucideIcon,
  Mail,
  MapPin,
  MessageCircle,
  Mic,
  Mountain,
  Music,
  Palette,
  PartyPopper,
  PenLine,
  Phone,
  Plane,
  Ship,
  Snowflake,
  Sparkles,
  Star,
  Stethoscope,
  Sun,
  Tent,
  Ticket,
  TrainFront,
  TreePine,
  Trophy,
  Users,
  Utensils,
  Video,
  Waves,
  Wine,
} from 'lucide-react'

/**
 * Icon catalog for activities. Only the key is stored in the DB.
 * The icon is purely visual: no names, no category, no filter – the user decides
 * what an icon means. Keys must never change.
 * New icons: add a line here, no migration needed. Order = order in the picker grid.
 */
export const ACTIVITY_ICONS = [
  { key: 'star', Icon: Star },
  { key: 'coffee', Icon: Coffee },
  { key: 'utensils', Icon: Utensils },
  { key: 'wine', Icon: Wine },
  { key: 'beer', Icon: Beer },
  { key: 'phone', Icon: Phone },
  { key: 'video', Icon: Video },
  { key: 'mail', Icon: Mail },
  { key: 'message', Icon: MessageCircle },
  { key: 'people', Icon: Users },
  { key: 'handshake', Icon: Handshake },
  { key: 'heart', Icon: Heart },
  { key: 'cake', Icon: Cake },
  { key: 'party', Icon: PartyPopper },
  { key: 'gift', Icon: Gift },
  { key: 'sparkles', Icon: Sparkles },
  { key: 'flower', Icon: Flower2 },
  { key: 'church', Icon: Church },
  { key: 'baby', Icon: Baby },
  { key: 'dog', Icon: Dog },
  { key: 'home', Icon: House },
  { key: 'key', Icon: Key },
  { key: 'grad', Icon: GraduationCap },
  { key: 'exam', Icon: PenLine },
  { key: 'book', Icon: BookOpen },
  { key: 'briefcase', Icon: Briefcase },
  { key: 'stethoscope', Icon: Stethoscope },
  { key: 'calendar', Icon: Calendar },
  { key: 'plane', Icon: Plane },
  { key: 'train', Icon: TrainFront },
  { key: 'car', Icon: Car },
  { key: 'ship', Icon: Ship },
  { key: 'globe', Icon: Globe },
  { key: 'map-pin', Icon: MapPin },
  { key: 'trip', Icon: Mountain },
  { key: 'tent', Icon: Tent },
  { key: 'tree', Icon: TreePine },
  { key: 'waves', Icon: Waves },
  { key: 'sun', Icon: Sun },
  { key: 'snowflake', Icon: Snowflake },
  { key: 'bike', Icon: Bike },
  { key: 'dumbbell', Icon: Dumbbell },
  { key: 'trophy', Icon: Trophy },
  { key: 'music', Icon: Music },
  { key: 'mic', Icon: Mic },
  { key: 'film', Icon: Film },
  { key: 'ticket', Icon: Ticket },
  { key: 'gamepad', Icon: Gamepad2 },
  { key: 'camera', Icon: Camera },
  { key: 'palette', Icon: Palette },
] as const satisfies readonly { key: string; Icon: LucideIcon }[]

export type ActivityIconKey = (typeof ACTIVITY_ICONS)[number]['key']

/** Default for new activities, matches the DEFAULT in the DB schema. */
export const DEFAULT_ACTIVITY_ICON: ActivityIconKey = 'star'

const byKey = new Map<string, (typeof ACTIVITY_ICONS)[number]>(ACTIVITY_ICONS.map((entry) => [entry.key, entry]))

/** Unknown keys (e.g. from older data) get the default icon. */
export function activityIcon(key: string): { key: string; Icon: LucideIcon } {
  return byKey.get(key) ?? byKey.get(DEFAULT_ACTIVITY_ICON)!
}

/** UI icons outside the catalog that are used in several places. */
export const ReminderIcon = Bell
export const LocationIcon = MapPin
