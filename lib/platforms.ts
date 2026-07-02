import { Music2, Clapperboard, Tv, Film, MonitorPlay, type LucideIcon } from "lucide-react";

// ---------------------------------------------------------------------------
// Streaming-platform registry.
//
// One generalized data model (Account + Slot) powers every platform. What makes
// Spotify behave like Spotify and Netflix behave like Netflix lives HERE, in
// code — not in the schema. To support a new platform (Hulu, UCine, Apple
// Music, …) add an entry below; the whole app adapts (nav grouping, forms,
// labels, defaults, colors, reminders).
// ---------------------------------------------------------------------------

export type PlatformConfig = {
  id: string; // stable key, stored on Account.platform / Payment.platform
  name: string; // display name, e.g. "Spotify"
  color: string; // brand color (hex)
  icon: LucideIcon;

  // Terminology
  accountNoun: string; // what one account is called, e.g. "family plan", "account"
  slotNoun: string; // what a rented slot is called, e.g. "member", "profile"
  slotNounPlural: string;
  slotNameLabel: string; // form label for Slot.name, e.g. "Spotify username"
  slotNamePlaceholder?: string;
  ownerLabel?: string; // if set, the account tracks an owner/admin name with this label
  planLabel?: string; // if set, the account tracks a plan/tier with this label
  planDefault?: string;

  // Behavior
  slotRequiresCustomer: boolean; // must a slot always be assigned to a person? (Spotify yes, Netflix no)
  slotRequiresName: boolean; // is Slot.name required? (Netflix profile name yes, Spotify username no)

  // Defaults used when creating accounts/slots
  defaultMaxSlots: number;
  defaultPrice: number;
  defaultMonthlyCost: number;
};

// Shared defaults for platforms that don't override them.
const BASE = {
  accountNoun: "account",
  slotNoun: "member",
  slotNounPlural: "members",
  slotNameLabel: "Username / label",
  slotRequiresCustomer: true,
  slotRequiresName: false,
  defaultMaxSlots: 5,
  defaultPrice: 2000,
  defaultMonthlyCost: 0,
} satisfies Partial<PlatformConfig>;

export const PLATFORMS: Record<string, PlatformConfig> = {
  spotify: {
    ...BASE,
    id: "spotify",
    name: "Spotify",
    color: "#16a34a",
    icon: Music2,
    accountNoun: "family plan",
    slotNoun: "member",
    slotNounPlural: "members",
    slotNameLabel: "Spotify username",
    slotNamePlaceholder: "their username",
    ownerLabel: "Admin (plan owner)",
    slotRequiresCustomer: true,
    slotRequiresName: false,
    defaultMaxSlots: 6,
    defaultPrice: 2000,
  },
  netflix: {
    ...BASE,
    id: "netflix",
    name: "Netflix",
    color: "#e11d2a",
    icon: Clapperboard,
    accountNoun: "account",
    slotNoun: "profile",
    slotNounPlural: "profiles",
    slotNameLabel: "Profile name",
    slotNamePlaceholder: "e.g. Profile 1",
    planLabel: "Plan",
    planDefault: "Premium",
    slotRequiresCustomer: false, // profiles can sit unassigned
    slotRequiresName: true,
    defaultMaxSlots: 5,
    defaultPrice: 3000,
  },
  hulu: {
    ...BASE,
    id: "hulu",
    name: "Hulu",
    color: "#1ce783",
    icon: Tv,
    slotNoun: "profile",
    slotNounPlural: "profiles",
    slotNameLabel: "Profile name",
    planLabel: "Plan",
    slotRequiresCustomer: false,
    slotRequiresName: true,
    defaultMaxSlots: 6,
    defaultPrice: 2500,
  },
  ucine: {
    ...BASE,
    id: "ucine",
    name: "UCine",
    color: "#f59e0b",
    icon: Film,
    slotNoun: "slot",
    slotNounPlural: "slots",
    slotNameLabel: "Slot label",
    slotRequiresCustomer: true,
    slotRequiresName: false,
    defaultMaxSlots: 4,
    defaultPrice: 1500,
  },
  apple_music: {
    ...BASE,
    id: "apple_music",
    name: "Apple Music",
    color: "#fa2d48",
    icon: Music2,
    accountNoun: "family plan",
    slotNoun: "member",
    slotNounPlural: "members",
    slotNameLabel: "Apple ID / label",
    ownerLabel: "Organizer",
    slotRequiresCustomer: true,
    slotRequiresName: false,
    defaultMaxSlots: 6,
    defaultPrice: 2000,
  },
};

// Platforms in display order (nav grouping, the "new account" picker).
export const PLATFORM_LIST: PlatformConfig[] = Object.values(PLATFORMS);

function titleCase(id: string): string {
  return id.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Always returns a config: unknown ids fall back to a sensible generic so the
// app never crashes on stray data.
export function getPlatform(id: string): PlatformConfig {
  return (
    PLATFORMS[id] ?? {
      ...BASE,
      id,
      name: titleCase(id),
      color: "#2563eb",
      icon: MonitorPlay,
    }
  );
}
