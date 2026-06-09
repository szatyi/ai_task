"use client";

import Link from "next/link";
import { FormEvent, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const wasRegistered = searchParams.get("registered") === "true";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: { message?: string } };
        setError(body.error?.message ?? "Login failed");
        return;
      }

      const me = await fetch("/api/auth/me");
      if (!me.ok) {
        router.push("/");
        return;
      }

      const meBody = (await me.json()) as { user: { role: "user" | "operator" } };
      if (meBody.user.role === "operator") {
        router.push("/admin/monitoring");
      } else {
        router.push("/subscriptions");
      }
    } catch {
      setError("Network error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-zinc-900">Sign In</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Sign in with your email to access your account.
          </p>

          {wasRegistered ? (
            <div className="mt-4 rounded-lg bg-emerald-50 p-3">
              <p className="text-sm font-medium text-emerald-900">
                ✓ Account created successfully!
              </p>
              <p className="mt-1 text-xs text-emerald-700">Please sign in to continue.</p>
            </div>
          ) : null}

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <div>
              <label className="block text-sm font-medium text-zinc-700" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900 outline-none ring-0 focus:border-zinc-500"
                placeholder="user@example.com"
              />
            </div>

            {error ? (
              <div className="rounded-lg bg-red-50 p-3">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 hover:bg-zinc-800"
            >
              {isSubmitting ? "Signing in..." : "Sign In"}
            </button>

            <p className="text-center text-sm text-zinc-600">
              Don't have an account?{" "}
              <Link href="/register" className="font-medium text-zinc-900 hover:underline">
                Create one
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-full flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white px-6 py-4">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
          <Link href="/" className="text-lg font-semibold text-zinc-900 hover:text-zinc-600">
            🔔 Alerting MVP
          </Link>
        </div>
      </header>

      {/* Main content */}
      <Suspense
        fallback={<div className="flex-1 flex items-center justify-center">Loading...</div>}
      >
        <LoginContent />
      </Suspense>
    </main>
  );
}
