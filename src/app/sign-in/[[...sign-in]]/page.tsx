import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      {/* fallback (not force) so a redirect_url from an invite page wins */}
      <SignIn fallbackRedirectUrl="/" />
    </main>
  );
}
