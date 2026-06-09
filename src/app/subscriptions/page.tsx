"use client";

import { FormEvent, useEffect, useState } from "react";

type SubscriptionItem = {
  id: string;
  alertRuleId: string;
  alertRuleName: string | null;
  channel: "email" | "slack";
  status: "active" | "inactive";
};

type AlertRule = {
  id: string;
  name: string;
  sourceType: "rss" | "api";
};

export default function SubscriptionsPage() {
  const [items, setItems] = useState<SubscriptionItem[]>([]);
  const [availableRules, setAvailableRules] = useState<AlertRule[]>([]);
  const [alertRuleId, setAlertRuleId] = useState("");
  const [channel, setChannel] = useState<"email" | "slack">("email");
  const [error, setError] = useState<string | null>(null);
  const [loadingRules, setLoadingRules] = useState(true);
  const [loadingSubscriptions, setLoadingSubscriptions] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadRules() {
    try {
      const response = await fetch("/api/admin/alert-rules");
      if (!response.ok) {
        return;
      }
      const body = (await response.json()) as { items: AlertRule[] };
      setAvailableRules(body.items);
    } finally {
      setLoadingRules(false);
    }
  }

  async function loadSubscriptions() {
    try {
      const response = await fetch("/api/subscriptions");
      if (!response.ok) {
        const body = (await response.json()) as { error?: { message?: string } };
        setError(body.error?.message ?? "Failed to load subscriptions");
        return;
      }

      const body = (await response.json()) as { items: SubscriptionItem[] };
      setItems(body.items);
    } finally {
      setLoadingSubscriptions(false);
    }
  }

  useEffect(() => {
    loadRules();
    loadSubscriptions();
  }, []);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ alertRuleId, channel }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: { message?: string } };
        setError(body.error?.message ?? "Failed to create subscription");
        return;
      }

      setAlertRuleId("");
      setChannel("email");
      await loadSubscriptions();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function deactivate(subscriptionId: string) {
    setError(null);

    try {
      const response = await fetch(`/api/subscriptions/${subscriptionId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "inactive" }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: { message?: string } };
        setError(body.error?.message ?? "Failed to deactivate subscription");
        return;
      }

      await loadSubscriptions();
    } catch (err) {
      setError("Network error while deactivating subscription");
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900">My Subscriptions</h1>
        <a className="text-sm text-zinc-600 underline hover:text-zinc-900" href="/">
          Back to home
        </a>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Subscribe to Alerts</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Select an available alert and choose your delivery channel
        </p>
        <form className="mt-4 grid gap-4 md:grid-cols-4" onSubmit={onCreate}>
          <div>
            <label className="text-xs font-medium uppercase text-zinc-500">Alert Rule</label>
            <select
              value={alertRuleId}
              onChange={(event) => setAlertRuleId(event.target.value)}
              className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              required
              disabled={loadingRules}
            >
              <option value="">{loadingRules ? "Loading..." : "Choose an alert..."}</option>
              {availableRules.map((rule) => (
                <option key={rule.id} value={rule.id}>
                  {rule.name} ({rule.sourceType})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium uppercase text-zinc-500">Channel</label>
            <select
              value={channel}
              onChange={(event) => setChannel(event.target.value as "email" | "slack")}
              className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            >
              <option value="email">📧 Email</option>
              <option value="slack">💬 Slack</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !alertRuleId}
            className="mt-6 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {isSubmitting ? "Saving..." : "Subscribe"}
          </button>
        </form>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Your Subscriptions</h2>
        {loadingSubscriptions ? (
          <p className="mt-4 text-sm text-zinc-600">Loading subscriptions...</p>
        ) : items.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600">
            No subscriptions yet. Subscribe to an alert above to get started.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-zinc-500">
                  <th className="py-2">Alert Name</th>
                  <th className="py-2">Channel</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-zinc-100">
                    <td className="py-3">
                      <div className="font-medium text-zinc-900">
                        {item.alertRuleName ?? "Unknown rule"}
                      </div>
                      <div className="font-mono text-xs text-zinc-500">{item.alertRuleId}</div>
                    </td>
                    <td className="py-3">{item.channel === "email" ? "📧 Email" : "💬 Slack"}</td>
                    <td className="py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          item.status === "active"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-zinc-100 text-zinc-800"
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3">
                      {item.status === "active" ? (
                        <button
                          className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-50"
                          onClick={() => deactivate(item.id)}
                          type="button"
                        >
                          Unsubscribe
                        </button>
                      ) : (
                        <span className="text-zinc-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
