"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Moon,
  Sun,
  Target,
  Upload,
  Download,
  Brain,
  LayoutGrid,
  Zap,
  Database,
} from "lucide-react";

interface MainHeaderProps {
  isDarkMode?: boolean;
  toggleDarkMode?: () => void;
}

const navItems = [
  { id: "gallery", href: "/", label: "Dataset Gallery", icon: LayoutGrid },
  { id: "pipeline", href: "/pipeline", label: "Pipeline Status", icon: Zap },
  { id: "export", href: "/export", label: "Export Data", icon: Download },
  { id: "upload", href: "/upload", label: "Upload Resources", icon: Upload },
  { id: "knowledge-distillation", href: "/knowledge-distillation", label: "Knowledge Distillation", icon: Brain },
  { id: "model-registry", href: "/model-registry", label: "Model Registry", icon: Database },
];

export default function MainHeader({ isDarkMode, toggleDarkMode }: MainHeaderProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }
    return pathname.startsWith(href);
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="bg-primary/10 p-1.5 rounded-md">
              <Target className="h-5 w-5 text-primary" />
            </div>
            <span className="text-lg font-bold tracking-tight">HILIPS</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link key={item.id} href={item.href}>
                <Button
                  variant={isActive(item.href) ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-2"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {toggleDarkMode && (
            <Button variant="ghost" size="icon" onClick={toggleDarkMode}>
              {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
