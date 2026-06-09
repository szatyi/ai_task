"use client";

import { FormEvent, useEffect, useState } from "react";

type Rule = {
  id: string;
  name: string;
  sourceType: "rss" | "api";
  sourceIdentifier: string;
  triggerCondition: string;
  status: "enabled" | "disabled";
};

export default function AdminAlertRulesPage() {
  const [items, setItems] = useState<Rule[]>([]);
  const [name, setName] = useState("");
  const [sourceType, setSourceType] = useState<"rss" | "api">("rss");
  const [sourceIdentifier, setSourceIdentifier] = useState("");
  const [triggerCondition, setTriggerCondition] = useState("contains:breaking");
  const [error, setError] = useState<string | null>(null);
  const [loadingRules, setLoadingRules] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function loadRules() {
    try {
      const response = await fetch("/api/admin/alert-rules");
      if (!response.ok) {
        const body = (await response.json()) as { error?: { message?: string } };
        setError(body.error?.message ?? "Failed to load rules");
        return;
      }

      const body = (await response.json()) as { items: Rule[] };
      setItems(body.items);
    } finally {
      setLoadingRules(false);
    }
  }

  useEffect(() => {
    loadRules();
  }, []);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/admin/alert-rules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          sourceType,
          sourceIdentifier,
          triggerCondition,
        }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: { message?: string } };
        setError(body.error?.message ?? "Failed to create rule");
        return;
      }

      setName("");
      setSourceType("rss");
      setSourceIdentifier("");
      setTriggerCondition("contains:breaking");
      await loadRules();
    } finally {
      setIsSubmitting(false);
    }
  }

  async function toggleStatus(rule: Rule) {
    const nextStatus = rule.status === "enabled" ? "disabled" : "enabled";
    setError(null);

    try {
      const response = await fetch(`/api/admin/alert-rules/${rule.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: { message?: string } };
        setError(body.error?.message ?? "Failed to update rule");
        return;
      }

      await loadRules();
    } catch (err) {
      setError("Network error while updating rule");
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-zinc-900">Alert Rules</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Create and manage curated alert rules that users can subscribe to
          </p>
        </div>
        <a
          className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-50"
          href="/admin/monitoring"
        >
          ← Monitoring
        </a>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Create New Alert Rule</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Define a new alert rule with a trigger condition based on a specific source
        </p>

        <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={onCreate}>
          <div>
            <label className="block text-sm font-medium text-zinc-700">Rule Name *</label>
            <input
              className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g., Breaking News Alert"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">Source Type *</label>
            <select
              className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
              value={sourceType}
              onChange={(event) => setSourceType(event.target.value as "rss" | "api")}
            >
              <option value="rss">RSS Feed</option>
              <option value="api">API</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">Source Identifier *</label>
            <input
              className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
              value={sourceIdentifier}
              onChange={(event) => setSourceIdentifier(event.target.value)}
              placeholder={sourceType === "rss" ? "https://example.com/feed" : "api-endpoint-name"}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700">Trigger Condition *</label>
            <input
              className="mt-2 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-500 focus:outline-none"
              value={triggerCondition}
              onChange={(event) => setTriggerCondition(event.target.value)}
              placeholder="e.g., contains:breaking"
              required
            />
          </div>

          <div className="md:col-span-2">
            <button
              className="rounded-lg bg-zinc-900 px-6 py-2 text-sm font-medium text-white disabled:opacity-60 hover:bg-zinc-800"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating..." : "Create Alert Rule"}
            </button>
          </div>
        </form>

        {error ? (
          <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>
        ) : null}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-zinc-900">Current Rules</h2>

        {loadingRules ? (
          <p className="mt-4 text-sm text-zinc-600">Loading rules...</p>
        ) : items.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-600">
            No alert rules yet. Create one above to get started.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-zinc-200">
                  <th className="py-3 px-3 text-left font-semibold text-zinc-900">Name</th>
                  <th className="py-3 px-3 text-left font-semibold text-zinc-900">Source</th>
                  <th className="py-3 px-3 text-left font-semibold text-zinc-900">Identifier</th>
                  <th className="py-3 px-3 text-left font-semibold text-zinc-900">Trigger</th>
                  <th className="py-3 px-3 text-left font-semibold text-zinc-900">Status</th>
                  <th className="py-3 px-3 text-left font-semibold text-zinc-900">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-zinc-100 hover:bg-zinc-50">
                    <td className="py-3 px-3">
                      <div className="font-medium text-zinc-900">{item.name}</div>
                      <div className="font-mono text-xs text-zinc-500">{item.id}</div>
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">
                        {item.sourceType === "rss" ? "📡 RSS" : "⚙️ API"}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <code className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-700">
                        {item.sourceIdentifier}
                      </code>
                    </td>
                    <td className="py-3 px-3">
                      <code className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-700">
                        {item.triggerCondition}
                      </code>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                          item.status === "enabled"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-zinc-100 text-zinc-800"
                        }`}
                      >
                        {item.status === "enabled" ? "✓ Enabled" : "✕ Disabled"}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <button
                        className="rounded border border-zinc-300 px-3 py-1 text-xs font-medium hover:bg-zinc-50"
                        onClick={() => toggleStatus(item)}
                        type="button"
                      >
                        {item.status === "enabled" ? "Disable" : "Enable"}
                      </button>
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
