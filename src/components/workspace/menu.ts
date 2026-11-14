import { BarChart3, FileText, Mail, Settings, type LucideIcon } from "lucide-react";

// The workspace menu as data (story CRM-S1.1a, D-38). Each epic that builds a section adds its item here: New quote, Home,
// Leads and Accounts are not listed until the stories that build them (CRM-Q2.1, CRM-H1, CRM-L1.1, CRM-A1.1), so the menu
// has no dead buttons.

/** The numbers the menu will show beside an item (story CRM-S1.1c, D-39). Not shown yet. */
export type MenuCountKey = "quotes" | "inbox";

export interface MenuItem {
  key: "quotes" | "inbox" | "reports" | "settings";
  label: string;
  /** Where it opens, path and query, until its own epic ships. */
  to: string;
  icon: LucideIcon;
  /** Which count CRM-S1.1c puts beside it; null for an item that has none. */
  countKey: MenuCountKey | null;
  /** Whether the page at this address belongs to the item, so the current section is marked (a record marks its section). */
  isCurrent: (pathname: string, search: URLSearchParams) => boolean;
}

/**
 * The address parameter that asks the queue for new PEO mail only. The queue page does not read it yet: the database filter
 * for "has new PEO mail" is story CRM-S3.3b, which will honour this parameter. Until then Inbox opens the whole queue.
 */
export const INBOX_PARAM = { name: "mail", value: "new" } as const;

const QUEUE = "/advisor";
const isQueue = (pathname: string) => pathname === QUEUE;
const isInbox = (pathname: string, search: URLSearchParams) => isQueue(pathname) && search.get(INBOX_PARAM.name) === INBOX_PARAM.value;

/** What Settings opens (D-38). Activity is for owners. `atFirmAddress`: the page works only at the firm's own address, so from the bare domain the link goes there. */
export const SETTINGS_LINKS: { label: string; description: string; to: string; ownersOnly?: boolean; atFirmAddress?: boolean }[] = [
  { label: "Mailbox", description: "Connect the mailbox you send from and read replies in.", to: "/advisor/mailbox" },
  { label: "Invitations", description: "Invite people, list the firm's Google domain or Microsoft tenant, and approve who asked to join.", to: "/firm/invitations", atFirmAddress: true },
  { label: "Members", description: "The people who belong to the firm: remove or suspend one.", to: "/advisor/members", ownersOnly: true },
  { label: "Activity", description: "Who did what in the firm, and when.", to: "/advisor/activity", ownersOnly: true },
  { label: "Referral partners", description: "The partners who send you intakes, with their links and counts.", to: "/advisor/partners" },
  { label: "PEOs", description: "The PEOs you can quote, and what each one asks for.", to: "/advisor/peos" },
  { label: "Outbox", description: "The notification emails, and any that did not go out.", to: "/advisor/outbox" },
];

export const SETTINGS_PATH = "/settings";

export const MENU_ITEMS: MenuItem[] = [
  {
    key: "quotes",
    label: "Quotes",
    to: QUEUE,
    icon: FileText,
    countKey: "quotes",
    isCurrent: (pathname, search) => (isQueue(pathname) && !isInbox(pathname, search)) || pathname.startsWith("/advisor/submissions/"),
  },
  { key: "inbox", label: "Inbox", to: `${QUEUE}?${INBOX_PARAM.name}=${INBOX_PARAM.value}`, icon: Mail, countKey: "inbox", isCurrent: isInbox },
  { key: "reports", label: "Reports", to: "/advisor/funnel", icon: BarChart3, countKey: null, isCurrent: (pathname) => pathname === "/advisor/funnel" },
];

/** Settings sits at the foot of the menu, with the signed-in person. Its pages mark it too. */
export const SETTINGS_ITEM: MenuItem = {
  key: "settings",
  label: "Settings",
  to: SETTINGS_PATH,
  icon: Settings,
  countKey: null,
  isCurrent: (pathname) => pathname === SETTINGS_PATH || SETTINGS_LINKS.some((l) => pathname === l.to),
};
