"use client";

import { FormEvent, useEffect, useState } from "react";

type Summary = {
  activeSubscriptions: number;
  recentDeliveries: number;
  recentFailures: number;
  health: string;
};

type Delivery = {
  id: string;
  eventId: string;
  subscriptionId: string;
  channel: "email" | "slack";
  status: "queued" | "sending" | "sent" | "failed" | "skipped";
  sentAt: string | null;
};

type Failure = {
  id: string;
  deliveryId: string;
  providerName: string;
  errorMessage: string;
  createdAt: string;
};

export default function AdminMonitoringPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [failures, setFailures] = useState<Failure[]>([]);
  const [testChannel, setTestChannel] = useState<"email" | "slack">("email");
  const [testTarget, setTestTarget] = useState("");
  const [testMessage, setTestMessage] = useState("Test notification from admin UI");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sendingTest, setSendingTest] = useState(false);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const [summaryResponse, deliveriesResponse, failuresResponse] = await Promise.all([
        fetch("/api/admin/monitoring/summary"),
        fetch("/api/admin/deliveries?limit=20"),
        fetch("/api/admin/failures"),
      ]);

      if (!summaryResponse.ok || !deliveriesResponse.ok || !failuresResponse.ok) {
        setError("Failed to load monitoring data. Ensure you are logged in as operator.");
        return;
      }

      const summaryBody = (await summaryResponse.json()) as Summary;
      const deliveriesBody = (await deliveriesResponse.json()) as { items: Delivery[] };
      const failuresBody = (await failuresResponse.json()) as { items: Failure[] };

      setSummary(summaryBody);
      setDeliveries(deliveriesBody.items);
      setFailures(failuresBody.items);
    } catch (err) {
      setError("Network error while loading monitoring data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function onSendTestNotification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setSendingTest(true);

    try {
      const response = await fetch("/api/admin/test-notifications", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channel: testChannel,
          target: testTarget || undefined,
          message: testMessage,
        }),
      });

      const body = (await response.json()) as {
        result?: { providerMessageId: string };
        error?: { message?: string };
      };

      if (!response.ok) {
        setError(body.error?.message ?? "Test notification failed");
        return;
      }

      const messageId = body.result?.providerMessageId ?? "pending";
      setNotice(`✓ Test notification sent successfully (ID: ${messageId})`);
      setTestTarget("");
      setTestMessage("Test notification from admin UI");

      // Reload data to show new test notification in history
      setTimeout(() => loadData(), 1000);
    } catch (err) {
      setError("Network error while sending test notification");
    } finally {
      setSendingTest(false);
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "sent":
        return "bg-emerald-100 text-emerald-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "skipped":
        return "bg-yellow-100 text-yellow-800";
      case "queued":
      case "sending":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-zinc-100 text-zinc-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
        return "✓";
      case "failed":
        return "✕";
      case "skipped":
        return "⊘";
      case "queued":
        return "⋯";
      case "sending":
        return "→";
      default:
        return "?";
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900">Admin Monitoring</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Monitor delivery health, manage test notifications, and track alert activity
          </p>
        </div>
        <a
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
          href="/admin/alert-rules"
        >
          Alert Rules →
        </a>
      </header>

      {loading ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <p className="text-sm text-zinc-600">Loading monitoring data...</p>
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 shadow-sm">
          <p className="text-sm text-red-700">{error}</p>
          <button
            onClick={() => loadData()}
            className="mt-4 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      ) : summary ? (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <MetricCard
              label="Active Subscriptions"
              value={summary.activeSubscriptions}
              icon="📋"
            />
            <MetricCard label="Recent Deliveries" value={summary.recentDeliveries} icon="📤" />
            <MetricCard label="Recent Failures" value={summary.recentFailures} icon="⚠️" />
            <MetricCard label="Health Status" value={summary.health} icon="🏥" />
          </section>

          <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">Send Test Notification</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Test email or Slack delivery without creating a real subscription
            </p>

            <form className="mt-4 grid gap-4 md:grid-cols-4" onSubmit={onSendTestNotification}>
              <div>
                <label className="text-xs font-medium uppercase text-zinc-500">Channel</label>
                <select
                  className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
                  value={testChannel}
                  onChange={(event) => setTestChannel(event.target.value as "email" | "slack")}
                >
                  <option value="email">📧 Email</option>
                  <option value="slack">💬 Slack</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium uppercase text-zinc-500">
                  Target (Optional)
                </label>
                <input
                  className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
                  value={testTarget}
                  onChange={(event) => setTestTarget(event.target.value)}
                  placeholder={testChannel === "email" ? "user@example.com" : "#channel-name"}
                />
              </div>

              <div>
                <label className="text-xs font-medium uppercase text-zinc-500">Message</label>
                <input
                  className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
                  value={testMessage}
                  onChange={(event) => setTestMessage(event.target.value)}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={sendingTest}
                className="mt-6 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 hover:bg-zinc-800"
              >
                {sendingTest ? "Sending..." : "Send Test"}
              </button>
            </form>

            {notice ? (
              <div className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
                {notice}
              </div>
            ) : null}
            {error ? (
              <div className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</div>
            ) : null}
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-zinc-900">Recent Deliveries</h2>
              <p className="mt-1 text-sm text-zinc-600">Last 20 delivery attempts</p>

              {deliveries.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-600">No recent deliveries</p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200">
                        <th className="py-3 px-3 text-left font-semibold text-zinc-900">ID</th>
                        <th className="py-3 px-3 text-left font-semibold text-zinc-900">Channel</th>
                        <th className="py-3 px-3 text-left font-semibold text-zinc-900">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deliveries.map((item) => (
                        <tr key={item.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                          <td className="py-2 px-3 font-mono text-xs text-zinc-600">
                            {item.id.slice(0, 8)}
                          </td>
                          <td className="py-2 px-3">
                            {item.channel === "email" ? "📧 Email" : "💬 Slack"}
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${getStatusColor(item.status)}`}
                            >
                              {getStatusIcon(item.status)} {item.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-zinc-900">Recent Failures</h2>
              <p className="mt-1 text-sm text-zinc-600">Latest delivery errors</p>

              {failures.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-600">
                  No recent failures - system is healthy!
                </p>
              ) : (
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-zinc-200">
                        <th className="py-3 px-3 text-left font-semibold text-zinc-900">
                          Provider
                        </th>
                        <th className="py-3 px-3 text-left font-semibold text-zinc-900">Error</th>
                      </tr>
                    </thead>
                    <tbody>
                      {failures.map((item) => (
                        <tr key={item.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                          <td className="py-2 px-3 font-medium text-zinc-900">
                            {item.providerName}
                          </td>
                          <td className="py-2 px-3 text-zinc-600">{item.errorMessage}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </>
      ) : null}
    </main>
  );
}

function MetricCard(props: { label: string; value: number | string; icon: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">{props.label}</p>
          <p className="mt-2 text-3xl font-bold text-zinc-900">{props.value}</p>
        </div>
        <div className="text-3xl opacity-50">{props.icon}</div>
      </div>
    </div>
  );
}
