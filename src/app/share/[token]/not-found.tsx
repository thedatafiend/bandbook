export default function ShareNotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
      <h1 className="text-2xl font-semibold text-foreground mb-2">
        Link unavailable
      </h1>
      <p className="text-muted max-w-sm">
        This recording link is invalid or has been revoked by its owner.
      </p>
    </main>
  );
}
