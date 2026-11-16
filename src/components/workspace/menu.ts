import { BarChart3, Building2, FileText, Mail, Plus, Settings, UserPlus, type LucideIcon } from "lucide-react";

// The workspace menu as data (story CRM-S1.1a, D-38). Each epic that builds a section adds its item here: the sections not built yet (Home) are not listed until the story that builds it (CRM-H1), so the menu has no dead buttons. Leads arrived with CRM-L1.1a.

/** The numbers the menu shows beside an item (story CRM-S1.1c, D-39; open leads, CRM-L1.1a). */
export type MenuCountKey = "quotes" | "inbox" | "leads";

/** The largest number the badge writes in full; above it the badge says "99+" (a screen reader still hears the real number). */
export const MENU_COUNT_CAP = 99;

/** What the badge shows: nothing for zero, the number up to the cap, then "99+". */
export const badgeText = (n: number): string | null => (n <= 0 ? null : n > MENU_COUNT_CAP ? `${MENU_COUNT_CAP}+` : String(n));

export interface MenuItem {
  key: "quotes" | "inbox" | "leads" | "accounts" | "reports" | "settings";
  label: string;
  /** Where it opens, path and query, until its own epic ships. */
  to: string;
  icon: LucideIcon;
  /** Which count CRM-S1.1c puts beside it; null for an item that has none. */
  countKey: MenuCountKey | null;
  /** What the number means, said after the item's name to a screen reader: "Quotes, 4 open". Null for an item with no count. */
  countWords: ((n: number) => string) | null;
  /** Whether the page at this address belongs to the item, so the current section is marked (a record marks its section). */
  isCurrent: (pathname: string, search: URLSearchParams) => boolean;
}

/**
 * The address parameter that asks the queue for new PEO mail only. The queue's table address reads it as the filter "has new PEO mail
 * is yes" (CRM-S3.5a) and rewrites the address to say so. Until CRM-E1.4 it was where the menu's Inbox went; the inbox now has its own page
 * (`INBOX_PATH`), and the old links keep opening the queue's own filter (D-8), which is part of Quotes.
 */
export const INBOX_PARAM = { name: "mail", value: "new" } as const;

const QUEUE = "/advisor";
const isQueue = (pathname: string) => pathname === QUEUE;

/** What Settings opens (D-38). Activity is for owners. `atFirmAddress`: the page works only at the firm's own address, so from the bare domain the link goes there. */
export const SETTINGS_LINKS: { label: string; description: string; to: string; ownersOnly?: boolean; atFirmAddress?: boolean }[] = [
  { label: "Mailbox", description: "Connect the email you write from. Nevermore only sends from it; your inbox stays yours.", to: "/advisor/mailbox" },
  { label: "Invitations", description: "Invite people, list the firm's Google domain or Microsoft tenant, and approve who asked to join.", to: "/firm/invitations", atFirmAddress: true },
  { label: "Members", description: "The people who belong to the firm: remove or suspend one.", to: "/advisor/members", ownersOnly: true },
  { label: "Activity", description: "Who did what in the firm, and when.", to: "/advisor/activity", ownersOnly: true },
  { label: "Referral partners", description: "The partners who send you intakes, with their links and counts.", to: "/advisor/partners" },
  { label: "PEOs", description: "The PEOs you can quote, and what each one asks for.", to: "/advisor/peos" },
  { label: "Outbox", description: "The notification emails, and any that did not go out.", to: "/advisor/outbox" },
];

export const SETTINGS_PATH = "/settings";
/** The page where a mailbox is connected and disconnected. */
export const MAILBOX_PATH = "/advisor/mailbox";
/** The inbox's page (CRM-E1.4). */
export const INBOX_PATH = "/inbox";

/** The address of New quote (CRM-Q2.1, D-1709). Step 1 is at this address; once there is an opportunity the address names it (`/new-quote/<id>`). */
export const NEW_QUOTE_PATH = "/new-quote";

/** New quote leads the menu on every page (CRM-Q2.1). It is an action more than a section, so it is drawn apart from the sections and never marked current. */
export const NEW_QUOTE_ITEM = { label: "New quote", to: NEW_QUOTE_PATH, icon: Plus } as const;

export const MENU_ITEMS: MenuItem[] = [
  {
    key: "quotes",
    label: "Quotes",
    to: QUEUE,
    icon: FileText,
    countKey: "quotes",
    countWords: (n) => `${n} open`,
    isCurrent: (pathname) => isQueue(pathname) || pathname.startsWith("/advisor/submissions/"),
  },
  // The inbox (CRM-E1.4): every message on the threads the person may see. Its number is the threads with new mail, PEO threads and conversations (D-695).
  { key: "inbox", label: "Inbox", to: INBOX_PATH, icon: Mail, countKey: "inbox", countWords: (n) => `${n} with new mail`, isCurrent: (pathname) => pathname === INBOX_PATH },
  // The leads table and, with slice 8.5, a lead's page (CRM-L1.1a). Its number is the open leads (New or Working) the person may see.
  { key: "leads", label: "Leads", to: "/leads", icon: UserPlus, countKey: "leads", countWords: (n) => `${n} open`, isCurrent: (pathname) => pathname === "/leads" || pathname.startsWith("/leads/") },
  // The accounts page, an account's page and an opportunity's page (CRM-A1.1a, CRM-A2.1b, CRM-O1.1b, D-421). The number beside it (screen 16) is not built yet.
  {
    key: "accounts", label: "Accounts", to: "/accounts", icon: Building2, countKey: null, countWords: null,
    isCurrent: (pathname) => pathname === "/accounts" || pathname.startsWith("/accounts/") || pathname.startsWith("/opportunities/"),
  },
  { key: "reports", label: "Reports", to: "/advisor/funnel", icon: BarChart3, countKey: null, countWords: null, isCurrent: (pathname) => pathname === "/advisor/funnel" },
];

/** Settings sits at the foot of the menu, with the signed-in person. Its pages mark it too. */
export const SETTINGS_ITEM: MenuItem = {
  key: "settings",
  label: "Settings",
  to: SETTINGS_PATH,
  icon: Settings,
  countKey: null,
  countWords: null,
  isCurrent: (pathname) => pathname === SETTINGS_PATH || SETTINGS_LINKS.some((l) => pathname === l.to),
};
