import { useEffect, useRef } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { LogOut, Menu as MenuIcon, ShieldCheck } from "lucide-react";
import LegalLinks from "@/components/LegalLinks";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarProvider, useSidebar,
} from "@/components/ui/sidebar";
import { SheetTitle } from "@/components/ui/sheet";
import { firmHostname } from "@/lib/firmHost";
import ClosingBanner from "./ClosingBanner";
import ConnectionBanner from "./ConnectionBanner";
import SupportBanner, { SupportEnded } from "./SupportBanner";
import { useSupportOver } from "./useSupportOver";
import { badgeText, MENU_ITEMS, SETTINGS_ITEM, type MenuItem } from "./menu";
import { useMenuCounts } from "./useMenuCounts";
import { useWorkspace, WorkspaceProvider } from "./useWorkspace";

// The class of the grey-and-blue look (D-41, src/index.css). It goes on the page's root element, not on the shell's own
// element, so dialogs, sheets and messages drawn outside the shell take the same look. Removed when the shell unmounts.
export const WORKSPACE_THEME_CLASS = "theme-workspace";

const initial = (name: string) => name.trim().charAt(0).toUpperCase() || "?";

const Item = ({ item, pathname, search, onChoose, count }: { item: MenuItem; pathname: string; search: URLSearchParams; onChoose: () => void; count?: number }) => {
  const here = item.isCurrent(pathname, search);
  const Icon = item.icon;
  const badge = count === undefined ? null : badgeText(count);
  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={here}>
        {/* With a badge the link is named "Quotes, 4 open", never read as a bare number; the number said is the real one, not the capped one. */}
        <Link to={item.to} onClick={onChoose} aria-current={here ? "page" : undefined} aria-label={badge && item.countWords ? `${item.label}, ${item.countWords(count as number)}` : undefined}>
          <Icon aria-hidden="true" />
          <span className="min-w-0 truncate">{item.label}</span>
          {badge && item.countWords && (
            <span aria-hidden="true" className="ml-auto min-w-5 shrink-0 rounded-full bg-sidebar-primary px-1.5 text-center text-xs font-semibold leading-5 text-sidebar-primary-foreground">{badge}</span>
          )}
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
};

const MenuBody = () => {
  const { isMobile, setOpenMobile } = useSidebar();
  // Choosing an item closes the menu opened over the page, including the item for the page already shown.
  const close = () => setOpenMobile(false);
  const { pathname, search } = useLocation();
  const params = new URLSearchParams(search);
  const { signOut } = useAuth();
  const { firm, role, isPlatformAdmin, person } = useWorkspace();
  const counts = useMenuCounts();
  return (
    <>
      {isMobile && <SheetTitle className="sr-only">Menu</SheetTitle>}
      <SidebarHeader className="p-3">
        <Link to="/advisor" onClick={close} className="flex items-center gap-3 rounded-md p-1 outline-none ring-sidebar-ring focus-visible:ring-2">
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-sidebar-primary font-semibold text-sidebar-primary-foreground">
            {firm ? initial(firm.name) : ""}
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate font-semibold">{firm?.name ?? ""}</span>
            <span className="block truncate text-xs text-sidebar-foreground/70">{firm ? firmHostname(firm.address) : ""}</span>
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="flex-1">
          <nav aria-label="Workspace" className="flex h-full flex-col">
            <SidebarMenu>
              {MENU_ITEMS.map((item) => <Item key={item.key} item={item} pathname={pathname} search={params} onChoose={close} count={item.countKey ? counts[item.countKey] : undefined} />)}
            </SidebarMenu>
            <SidebarMenu className="mt-auto">
              {isPlatformAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <Link to="/advisor/firms" onClick={close}><ShieldCheck aria-hidden="true" /><span>Nevermore admin</span></Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
              <Item item={SETTINGS_ITEM} pathname={pathname} search={params} onChoose={close} />
            </SidebarMenu>
          </nav>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-3">
          <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sidebar-accent text-xs font-semibold text-sidebar-accent-foreground">
            {initial(person)}
          </span>
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-sm font-semibold">{person}</span>
            <span className="block text-xs text-sidebar-foreground/70">{role}</span>
          </span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-md text-sidebar-foreground/80 outline-none ring-sidebar-ring hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Sign out</span>
          </button>
        </div>
      </SidebarFooter>
    </>
  );
};

// Going to another page closes the menu that was opened over the page. Always mounted, so it sees the change.
const CloseOnNavigate = () => {
  const { setOpenMobile } = useSidebar();
  const { pathname, search } = useLocation();
  const was = useRef(pathname + search);
  useEffect(() => {
    if (was.current === pathname + search) return;
    was.current = pathname + search;
    setOpenMobile(false);
  }, [pathname, search, setOpenMobile]);
  return null;
};

const PhoneBar = () => {
  const { toggleSidebar } = useSidebar();
  const { firm } = useWorkspace();
  return (
    <div className="flex items-center gap-2 border-b border-border bg-card px-4 py-2 md:hidden">
      <button
        type="button"
        onClick={toggleSidebar}
        aria-label="Menu"
        className="flex min-h-11 min-w-11 items-center justify-center rounded-md hover:bg-muted"
      >
        <MenuIcon className="h-5 w-5" aria-hidden="true" />
      </button>
      <span className="truncate font-semibold">{firm?.name ?? ""}</span>
    </div>
  );
};

// The part of the frame that needs the workspace's answer (so it sits inside the provider): the banners and the page, or, once a support
// session's hour is over, the page that says so in the page's place.
const Frame = () => {
  const { supportEndsAt } = useWorkspace();
  const supportOver = useSupportOver(supportEndsAt);
  return (
    <>
      <PhoneBar />
      <SupportBanner />
      <ClosingBanner />
      <ConnectionBanner />
      {supportOver ? <SupportEnded /> : <Outlet />}
      <div className="flex justify-center pb-8 pt-4"><LegalLinks compact /></div>
    </>
  );
};

/**
 * The frame of every member page (story CRM-S1.1a, D-37 to D-42): the menu down the left, which at phone width is a
 * button that opens it over the page, and the page itself beside it. It is a layout route: the guard sits around it in
 * src/App.tsx, so it only ever draws for a current member of a firm. It decides what to show, never who may read what.
 */
const WorkspaceShell = () => {
  useEffect(() => {
    document.documentElement.classList.add(WORKSPACE_THEME_CLASS);
    return () => document.documentElement.classList.remove(WORKSPACE_THEME_CLASS);
  }, []);
  // Ctrl/Cmd+B is the menu provider's shortcut for hiding the menu, and a hidden desktop menu has no button to bring it back.
  // This sees the key first (capture phase) and keeps it from the provider, without taking it from the browser.
  useEffect(() => {
    const keepMenuOpen = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "b" && (event.ctrlKey || event.metaKey)) event.stopImmediatePropagation();
    };
    window.addEventListener("keydown", keepMenuOpen, true);
    return () => window.removeEventListener("keydown", keepMenuOpen, true);
  }, []);
  return (
    <WorkspaceProvider>
    <SidebarProvider>
      <CloseOnNavigate />
      <Sidebar collapsible="offcanvas">
        <MenuBody />
      </Sidebar>
      <div className="min-w-0 flex-1 bg-background text-foreground">
        <Frame />
      </div>
    </SidebarProvider>
    </WorkspaceProvider>
  );
};

export default WorkspaceShell;
