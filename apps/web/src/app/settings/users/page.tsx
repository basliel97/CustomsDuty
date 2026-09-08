"use client";

import { useEffect, useState } from "react";
import { Plus, X, UserCheck, UserX } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { AppShell } from "@/components/layout/app-shell";
import { api } from "@/lib/api-client";
import type { UserRow } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { UserStatusBadge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { PageLoader } from "@/components/ui/spinner";
import { Alert } from "@/components/ui/alert";

const ROLES = ["IMPORTER", "VALUATION_OFFICER", "TARIFF_SPECIALIST", "SUPER_ADMIN"] as const;

const ROLE_BADGE_TONE: Record<string, "gray" | "blue" | "green" | "yellow" | "red" | "purple"> = {
  IMPORTER: "blue",
  VALUATION_OFFICER: "green",
  TARIFF_SPECIALIST: "purple",
  SUPER_ADMIN: "red",
};

const defaultForm = {
  full_name: "",
  email: "",
  password: "",
  role: "IMPORTER" as string,
  branch_id: "",
  phone: "",
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(defaultForm);
  const [search, setSearch] = useState("");

  function fetchUsers() {
    api
      .get<UserRow[]>("/users")
      .then((res) => setUsers((res.data ?? []) as UserRow[]))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload: Record<string, unknown> = {
        full_name: form.full_name,
        email: form.email,
        password: form.password,
        role: form.role,
      };
      if (form.branch_id) payload.branch_id = form.branch_id;
      if (form.phone) payload.phone = form.phone;
      await api.post("/users", payload);
      setShowForm(false);
      setForm(defaultForm);
      fetchUsers();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Create failed";
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(u: UserRow) {
    const newStatus = u.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    if (!confirm(`${newStatus === "SUSPENDED" ? "Suspend" : "Activate"} ${u.full_name || u.email}?`)) return;
    try {
      await api.patch(`/users/${u.id}/status`, { status: newStatus });
      fetchUsers();
    } catch {
      // silently ignore
    }
  }

  async function changeRole(u: UserRow, newRole: string) {
    if (!confirm(`Change role of ${u.full_name || u.email} to ${newRole}?`)) return;
    try {
      await api.patch(`/users/${u.id}/role`, { role: newRole });
      fetchUsers();
    } catch {
      // silently ignore
    }
  }

  function updateField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const filtered = users.filter(
    (u) =>
      (u.full_name ?? "").toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.role.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <PageLoader label="Loading users..." />;

  return (
    <RequireAuth roles={["SUPER_ADMIN"]}>
      <AppShell>
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Users</h1>
              <p className="text-sm text-gray-500">Manage system users and roles</p>
            </div>
            <Button onClick={() => { setShowForm(!showForm); setError(""); }}>
              {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
              {showForm ? "Cancel" : "Create User"}
            </Button>
          </div>

          {showForm && (
            <Card>
              <CardHeader>
                <CardTitle>Create User</CardTitle>
              </CardHeader>
              <CardContent>
                {error && (
                  <Alert tone="error" className="mb-4">
                    {error}
                  </Alert>
                )}
                <form onSubmit={handleCreate} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <div>
                    <Label htmlFor="full_name">Full Name</Label>
                    <Input id="full_name" value={form.full_name} onChange={(e) => updateField("full_name", e.target.value)} required />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} required />
                  </div>
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input id="password" type="password" value={form.password} onChange={(e) => updateField("password", e.target.value)} required minLength={8} />
                  </div>
                  <div>
                    <Label htmlFor="role">Role</Label>
                    <Select id="role" value={form.role} onChange={(e) => updateField("role", e.target.value)}>
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r.replace("_", " ")}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="branch_id">Branch ID (optional)</Label>
                    <Input id="branch_id" value={form.branch_id} onChange={(e) => updateField("branch_id", e.target.value)} />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone (optional)</Label>
                    <Input id="phone" value={form.phone} onChange={(e) => updateField("phone", e.target.value)} />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-3">
                    <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving ? "Creating..." : "Create User"}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>All Users ({filtered.length})</CardTitle>
              <Input
                placeholder="Search users..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64"
              />
            </CardHeader>
            <CardContent>
              <div className="-mx-5 overflow-x-auto px-5">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Email</th>
                      <th className="py-2 pr-4">Role</th>
                      <th className="py-2 pr-4">Branch</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4">Created</th>
                      <th className="py-2 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((u) => (
                      <tr key={u.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                        <td className="py-3 pr-4 font-medium text-gray-900">{u.full_name ?? "—"}</td>
                        <td className="py-3 pr-4 text-gray-700">{u.email}</td>
                        <td className="py-3 pr-4">
                          <Badge tone={ROLE_BADGE_TONE[u.role] ?? "gray"}>{u.role.replace("_", " ")}</Badge>
                        </td>
                        <td className="py-3 pr-4 text-gray-500">{u.branch_id ?? "—"}</td>
                        <td className="py-3 pr-4">
                          <UserStatusBadge status={u.status} />
                        </td>
                        <td className="py-3 pr-4 text-gray-500">{u.created_at ? new Date(u.created_at).toLocaleDateString("en-ET") : "—"}</td>
                        <td className="py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Select
                              value={u.role}
                              onChange={(e) => changeRole(u, e.target.value)}
                              className="h-8 w-auto text-xs"
                            >
                              {ROLES.map((r) => (
                                <option key={r} value={r}>
                                  {r.replace("_", " ")}
                                </option>
                              ))}
                            </Select>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => toggleStatus(u)}
                              title={u.status === "ACTIVE" ? "Suspend" : "Activate"}
                            >
                              {u.status === "ACTIVE" ? (
                                <UserX className="h-4 w-4 text-red-500" />
                              ) : (
                                <UserCheck className="h-4 w-4 text-emerald-500" />
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-sm text-gray-500">
                          No users found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppShell>
    </RequireAuth>
  );
}
