import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      {/* fallback (not force) so a redirect_url from an invite page wins */}
      <SignUp fallbackRedirectUrl="/" />
    </main>
  );
}
