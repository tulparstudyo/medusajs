import {
  ArchiveBoxIcon,
  BoltIcon,
  BriefcaseIcon,
  CameraIcon,
  ChatBubbleLeftRightIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ComputerDesktopIcon,
  CreditCardIcon,
  CubeIcon,
  DevicePhoneMobileIcon,
  EnvelopeIcon,
  FireIcon,
  GiftIcon,
  GlobeAltIcon,
  HeartIcon,
  HomeIcon,
  LockClosedIcon,
  MusicalNoteIcon,
  PlayIcon,
  ShieldCheckIcon,
  ShoppingBagIcon,
  ShoppingCartIcon,
  SparklesIcon,
  SpeakerWaveIcon,
  Squares2X2Icon,
  StarIcon,
  TagIcon,
  TrashIcon,
  TruckIcon,
  UserGroupIcon,
  UserIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"
import type { ComponentType, SVGProps } from "react"

type IconComponent = ComponentType<SVGProps<SVGSVGElement>>

export const themeIcons = {
  sparkles: SparklesIcon,
  tag: TagIcon,
  "shopping-bag": ShoppingBagIcon,
  "shopping-cart": ShoppingCartIcon,
  gift: GiftIcon,
  heart: HeartIcon,
  star: StarIcon,
  truck: TruckIcon,
  "device-phone-mobile": DevicePhoneMobileIcon,
  "computer-desktop": ComputerDesktopIcon,
  home: HomeIcon,
  bolt: BoltIcon,
  fire: FireIcon,
  camera: CameraIcon,
  "musical-note": MusicalNoteIcon,
  "credit-card": CreditCardIcon,
  "shield-check": ShieldCheckIcon,
  "archive-box": ArchiveBoxIcon,
  cube: CubeIcon,
  user: UserIcon,
  "globe-alt": GlobeAltIcon,
  "lock-closed": LockClosedIcon,
  check: CheckIcon,
  trash: TrashIcon,
  "chevron-left": ChevronLeftIcon,
  "chevron-right": ChevronRightIcon,
  "chevron-down": ChevronDownIcon,
  play: PlayIcon,
  "speaker-wave": SpeakerWaveIcon,
  briefcase: BriefcaseIcon,
  "user-group": UserGroupIcon,
  "x-mark": XMarkIcon,
  "squares-2x2": Squares2X2Icon,
  envelope: EnvelopeIcon,
  "chat-bubble-left-right": ChatBubbleLeftRightIcon,
} satisfies Record<string, IconComponent>

export type ThemeIconName = keyof typeof themeIcons

export function ThemeIcon({
  name,
  className,
}: {
  name: ThemeIconName
  className?: string
}) {
  const Icon = themeIcons[name]
  return <Icon className={className} aria-hidden="true" />
}
