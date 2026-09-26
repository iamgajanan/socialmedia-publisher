import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { SignUpForm } from "@/components/sign-up-form";

export default function Page() {
  return <main className="flex min-h-svh items-center justify-center bg-muted/20 p-6 md:p-10"><div className="w-full max-w-sm"><Link href="/" className="mb-8 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Back to OmniSocial</Link><div className="mb-7 text-center"><div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Sparkles className="h-5 w-5" /></div><h1 className="mt-4 text-2xl font-semibold tracking-tight">Create your workspace</h1><p className="mt-1 text-sm text-muted-foreground">Start building your social publishing workflow.</p></div><SignUpForm /></div></main>;
}
