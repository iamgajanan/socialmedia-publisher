import { Bell, Building2, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function SettingsPage() {
  return (
    <div className="space-y-8">
      <div><p className="text-sm font-medium text-muted-foreground">Workspace</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Settings</h1><p className="mt-2 text-sm text-muted-foreground">Manage your account and publishing preferences.</p></div>
      <div className="grid gap-4 lg:grid-cols-3">
        {[{icon:UserRound,title:"Profile",text:"Your name and account details."},{icon:Building2,title:"Workspace",text:"Business and workspace configuration."},{icon:Bell,title:"Notifications",text:"Choose how product updates reach you."}].map(({icon:Icon,title,text}) => <div key={title} className="rounded-2xl border bg-card p-6"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted"><Icon className="h-5 w-5" /></div><h2 className="mt-5 font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p><Button variant="outline" className="mt-5" disabled>Configure</Button></div>)}
      </div>
    </div>
  );
}
