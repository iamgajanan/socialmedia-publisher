import Link from "next/link";
import { Menu, Sparkles } from "lucide-react";
import { AuthButton } from "./auth-button";
import { Button } from "./ui/button";

export function DashboardHeader() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/90 px-4 backdrop-blur sm:px-6">
      <div className="flex items-center gap-3">
        <Button asChild size="icon" variant="ghost" className="lg:hidden"><Link href="/dashboard" aria-label="Dashboard"><Menu /></Link></Button>
        <div className="flex items-center gap-2 lg:hidden"><Sparkles className="h-4 w-4" /><span className="font-semibold">OmniSocial</span></div>
        <p className="hidden text-sm text-muted-foreground sm:block">Social publishing workspace</p>
      </div>
      <AuthButton />
    </header>
  );
}
