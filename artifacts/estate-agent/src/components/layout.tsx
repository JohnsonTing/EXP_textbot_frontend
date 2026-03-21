import { Link, useLocation } from "wouter";
import { MessageSquare, Users, LayoutDashboard, Building2, Bell } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  const navItems = [
    { href: "/", icon: MessageSquare, label: "Conversations" },
    { href: "/contacts", icon: Users, label: "Contacts" },
    { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  ];

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar text-sidebar-foreground flex flex-col shadow-2xl z-20 transition-all duration-300">
        <div className="p-6 flex items-center gap-3 border-b border-sidebar-border/50">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-500 flex items-center justify-center shadow-lg shadow-primary/20">
            <Building2 className="text-white" size={22} />
          </div>
          <h1 className="text-xl font-display font-bold tracking-wide">
            Estato<span className="text-primary-foreground/50">CRM</span>
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
          <div className="flex items-center gap-3 px-2 py-3 rounded-xl hover:bg-sidebar-accent transition-colors cursor-pointer">
            <Avatar className="w-10 h-10 border-2 border-sidebar-border">
              <AvatarImage src="https://i.pravatar.cc/150?u=estate_agent" />
              <AvatarFallback>AG</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate text-sidebar-foreground">Alex Agent</p>
              <p className="text-xs text-sidebar-foreground/50 truncate">alex@estato.com</p>
            </div>
          </div>
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
