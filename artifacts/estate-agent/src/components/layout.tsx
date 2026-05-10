import { Link, useLocation } from "wouter";
import { useState } from "react";
import { MessageSquare, Users, LayoutDashboard, Building2, Bell, LogOut, UserCircle, ChevronUp, Mail, Shield } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth, useLogout } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user } = useAuth();
  const logout = useLogout();
  const [profileOpen, setProfileOpen] = useState(false);

  const navItems = [
    { href: "/", icon: MessageSquare, label: "Conversations" },
    { href: "/contacts", icon: Users, label: "Contacts" },
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Profile Dialog */}
      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>My Profile</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <Avatar className="w-20 h-20 text-2xl border-2 border-border">
              <AvatarFallback className="text-2xl">{user ? getInitials(user.name) : "…"}</AvatarFallback>
            </Avatar>
            <div className="text-center">
              <p className="text-lg font-semibold">{user?.name}</p>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Mail size={16} className="text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Email</p>
                <p className="text-sm font-medium">{user?.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Shield size={16} className="text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs text-muted-foreground">Role</p>
                <p className="text-sm font-medium capitalize">{user?.role ?? "agent"}</p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sidebar */}
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col shadow-2xl z-20 transition-all duration-300">
        <div className="p-6 flex items-center gap-3 border-b border-sidebar-border/50">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
            <Building2 className="text-white" size={22} />
          </div>
          <h1 className="text-xl font-display font-bold tracking-wide">
            Chloe<span className="text-primary-foreground/50"> Chat</span>
          </h1>
        </div>

        <nav className="flex-1 py-6 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
                  ${isActive
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-md font-medium"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"}
                `}
              >
                <item.icon
                  size={20}
                  className={`transition-colors ${isActive ? "text-primary-foreground" : "group-hover:text-sidebar-foreground"}`}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border/50">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <div className="flex items-center gap-3 px-2 py-3 rounded-xl hover:bg-sidebar-accent transition-colors cursor-pointer">
                <Avatar className="w-10 h-10 border-2 border-sidebar-border">
                  <AvatarFallback>{user ? getInitials(user.name) : "…"}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate text-sidebar-foreground">{user?.name ?? ""}</p>
                  <p className="text-xs text-sidebar-foreground/50 truncate">{user?.email ?? ""}</p>
                </div>
                <ChevronUp size={16} className="text-sidebar-foreground/40 shrink-0" />
              </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-56 mb-1">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-0.5">
                  <span className="font-medium">{user?.name}</span>
                  <span className="text-xs text-muted-foreground">{user?.email}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 cursor-pointer"
                onSelect={() => setProfileOpen(true)}
              >
                <UserCircle size={16} />
                My profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                onSelect={() => logout.mutateAsync().then(() => window.location.reload())}
              >
                <LogOut size={16} />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 relative">
        <header className="h-16 border-b border-border/50 bg-card/50 backdrop-blur-md flex items-center justify-between px-6 z-10 sticky top-0">
          <h2 className="text-xl font-display font-semibold text-foreground capitalize">
            {location === "/" ? "Conversations" : location.replace("/", "")}
          </h2>
          <div className="flex items-center gap-4">
            <button className="relative p-2 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
              <Bell size={20} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full border-2 border-card"></span>
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto bg-background/50">
          {children}
        </div>
      </main>
    </div>
  );
}
