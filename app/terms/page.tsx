export const metadata = { title: "Terms of Service | OmniSocial" };

export default function TermsPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Terms of Service</h1>
      <p className="mt-3 text-sm text-muted-foreground">Last updated: October 8, 2026</p>
      <div className="mt-10 space-y-8 text-sm leading-7">
        <section><h2 className="text-xl font-semibold">Use of OmniSocial</h2><p className="mt-2">OmniSocial helps users manage, schedule, publish, and review social-media content. You are responsible for the content you publish and for complying with the rules and terms of each connected platform.</p></section>
        <section><h2 className="text-xl font-semibold">Connected accounts</h2><p className="mt-2">When you connect a social account, you authorize OmniSocial to perform the actions and access the information covered by the permissions you grant. You may revoke access through the relevant platform at any time.</p></section>
        <section><h2 className="text-xl font-semibold">Acceptable use</h2><p className="mt-2">You must not use OmniSocial to distribute unlawful, fraudulent, abusive, or rights-infringing content, or to circumvent platform safeguards or rate limits.</p></section>
        <section><h2 className="text-xl font-semibold">Availability</h2><p className="mt-2">We may change or temporarily suspend features to maintain, secure, or improve the service. Third-party platform availability and permissions are outside our control.</p></section>
        <section><h2 className="text-xl font-semibold">Contact</h2><p className="mt-2">For support regarding OmniSocial, use the support contact provided by the service operator.</p></section>
      </div>
    </main>
  );
}
