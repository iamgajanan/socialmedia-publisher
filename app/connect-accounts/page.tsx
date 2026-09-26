import { Facebook, Instagram, Linkedin, Twitter } from "lucide-react";

const accounts = [
  { name: "Instagram", description: "Connect an Instagram professional account.", icon: Instagram },
  { name: "Facebook", description: "Connect a Facebook page.", icon: Facebook },
  { name: "LinkedIn", description: "Connect a personal or company page.", icon: Linkedin },
  { name: "X", description: "Connect an X account.", icon: Twitter },
];

export default function ConnectAccountsPage() {
  return (
    <div className="space-y-8">
      <div><p className="text-sm font-medium text-muted-foreground">Distribution</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Connect accounts</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Manage the social destinations you will use for publishing. OAuth connections are intentionally not activated in this milestone.</p></div>
      <div className="grid gap-4 md:grid-cols-2">
        {accounts.map(({ name, description, icon: Icon }) => <div key={name} className="flex items-center justify-between rounded-2xl border bg-card p-5"><div className="flex items-center gap-4"><div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted"><Icon className="h-5 w-5" /></div><div><p className="font-medium">{name}</p><p className="mt-1 text-sm text-muted-foreground">{description}</p></div></div><span className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground">Coming next</span></div>)}
      </div>
    </div>
  );
}
