"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type MeResponse = {
  user: {
    id: string;
    email: string;
    role: "user" | "operator";
  };
};

export default function Home() {
  const router = useRouter();
  const [user, setUser] = useState<MeResponse["user"] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        const body = (await response.json()) as MeResponse;
        return body.user;
      })
      .then((resolvedUser) => setUser(resolvedUser))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      router.push("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <main className="min-h-full flex flex-col">
      {/* Header with logout */}
      <header className="border-b border-zinc-200 bg-white px-6 py-4">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between">
          <h1 className="text-lg font-semibold text-zinc-900">🔔 Alerting MVP</h1>
          {user ? (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm font-medium text-zinc-900">{user.email}</p>
                <p className="text-xs text-zinc-600">
                  {user.role === "operator" ? "👨‍💼 Operator" : "👤 User"}
                </p>
              </div>
              <button
                onClick={handleLogout}
                className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
              >
                Logout
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-10">
          <section className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-blue-50 to-cyan-50 p-8">
            <h2 className="text-3xl font-semibold tracking-tight text-zinc-900">
              Alert Subscription & Monitoring
            </h2>
            <p className="mt-3 text-base text-zinc-700">
              Subscribe to alerts for important events and receive notifications via email or Slack.
              Operators can manage rules and monitor delivery health.
            </p>
          </section>

          {loading ? (
            <p className="text-sm text-zinc-600">Loading...</p>
          ) : user ? (
            <>
              {user.role === "operator" ? (
                <section className="space-y-4">
                  <h3 className="text-lg font-semibold text-zinc-900">Operator Tools</h3>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Link
                      className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
                      href="/admin/alert-rules"
                    >
                      <h4 className="text-lg font-semibold text-zinc-900">📋 Manage Alert Rules</h4>
                      <p className="mt-2 text-sm text-zinc-600">
                        Create, enable, or disable alert rules that users can subscribe to.
                      </p>
                    </Link>

                    <Link
                      className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
                      href="/admin/monitoring"
                    >
                      <h4 className="text-lg font-semibold text-zinc-900">
                        📊 Monitor System Health
                      </h4>
                      <p className="mt-2 text-sm text-zinc-600">
                        View delivery metrics, recent failures, and send test notifications.
                      </p>
                    </Link>
                  </div>
                </section>
              ) : null}

              <section className="space-y-4">
                <h3 className="text-lg font-semibold text-zinc-900">Your Subscriptions</h3>
                <Link
                  className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
                  href="/subscriptions"
                >
                  <h4 className="text-lg font-semibold text-zinc-900">🔔 Manage Subscriptions</h4>
                  <p className="mt-2 text-sm text-zinc-600">
                    Subscribe to alerts and choose your preferred notification channels.
                  </p>
                </Link>
              </section>
            </>
          ) : (
            <section className="space-y-4">
              <h3 className="text-lg font-semibold text-zinc-900">Get Started</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <Link
                  className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
                  href="/login"
                >
                  <h4 className="text-lg font-semibold text-zinc-900">🔐 Sign In</h4>
                  <p className="mt-2 text-sm text-zinc-600">
                    Sign in with your email to access your account.
                  </p>
                </Link>
                <Link
                  className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow"
                  href="/register"
                >
                  <h4 className="text-lg font-semibold text-zinc-900">✨ Create Account</h4>
                  <p className="mt-2 text-sm text-zinc-600">
                    Create a new account to start subscribing to alerts.
                  </p>
                </Link>
              </div>
            </section>
          )}

          <section className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              About This Demo
            </h3>
            <p className="mt-3 text-sm text-zinc-700">
              This is a demo of the Alerting MVP. Users can subscribe to predefined alerts and
              receive notifications via email or Slack. Operators manage alert rules and monitor
              delivery health.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
