"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminLogin } from "@/app/actions/admin-actions";
import { Card, Input, Label } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(false);
    const { ok } = await adminLogin(password);
    if (ok) {
      router.push("/admin");
      router.refresh();
    } else {
      setError(true);
      setLoading(false);
    }
  }

  return (
    <main className="flex-1 flex items-center justify-center bg-gradient-to-b from-sky to-white px-4">
      <Card className="p-8 w-full max-w-sm">
        <h1 className="text-lg font-bold mb-1">Area amministratore</h1>
        <p className="text-sm text-gray-500 mb-6">Gestione punti di interesse e itinerari.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              required
            />
          </div>
          {error && <p className="text-sm text-red-600">Password errata.</p>}
          <Button type="submit" disabled={loading} className="w-full py-2.5">
            {loading ? "Accesso…" : "Accedi"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
