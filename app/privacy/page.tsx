export const metadata = { title: "Privacy Policy | OmniSocial" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="text-4xl font-semibold tracking-tight">Privacy Policy</h1>
      <p className="mt-3 text-sm text-muted-foreground">Last updated: October 8, 2026</p>
      <div className="mt-10 space-y-8 text-sm leading-7">
        <section><h2 className="text-xl font-semibold">Information we process</h2><p className="mt-2">OmniSocial processes account information, social account identifiers, publishing content, scheduling information, and platform analytics needed to provide the service.</p></section>
        <section><h2 className="text-xl font-semibold">Social platform data</h2><p className="mt-2">When you connect a social platform, OmniSocial uses the permissions you grant to authenticate, publish content, retrieve account information, and retrieve analytics supported by that platform.</p></section>
        <section><h2 className="text-xl font-semibold">Security</h2><p className="mt-2">OAuth credentials and access tokens are handled server-side and protected using application security controls. We do not intentionally expose access tokens in the client interface.</p></section>
        <section><h2 className="text-xl font-semibold">Retention and deletion</h2><p className="mt-2">Data is retained only as needed to provide the service, maintain account and publishing history, and meet operational or legal requirements. You can disconnect connected social accounts from OmniSocial and revoke authorization with the relevant platform.</p></section>
        <section><h2 className="text-xl font-semibold">Contact</h2><p className="mt-2">For privacy questions or requests, use the support contact provided by the service operator.</p></section>
      </div>
    </main>
  );
}
