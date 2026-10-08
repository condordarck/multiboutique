"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface LoginResponse {
  user?: {
    role: string;
    boutique_ids: string[];
  };
  error?: string;
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "";

  // Anti open-redirect : seuls les chemins internes propres sont acceptés.
  // Rejette notamment les URL protocol-relative ("//evil.com") et les doublons de slashe.
  function redirectSain(value: string): string | null {
    if (!value || value.length > 300) return null;
    if (!value.startsWith("/") || value.startsWith("//")) return null;
    if (/[\\\r\n\t\0-\u001f]/.test(value)) return null;
    if (/^\/[a-z][a-z0-9+.-]*:/i.test(value)) return null;
    return value;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data: LoginResponse = await res.json();

    if (!res.ok || !data.user) {
      setError(data.error || "Erreur de connexion");
      setLoading(false);
      return;
    }

    // Redirection intelligente après connexion
    const cible = redirectSain(redirectTo);
    if (cible) {
      router.push(cible);
    } else if (data.user.role === "administrateur") {
      router.push("/admin");
    } else if (data.user.role === "proprietaire") {
      router.push("/dashboard");
    } else if (data.user.role === "client") {
      router.push("/client");
    } else if (data.user.boutique_ids && data.user.boutique_ids.length > 0) {
      router.push(`/dashboard/${data.user.boutique_ids[0]}`);
    } else {
      router.push("/dashboard");
    }

    setLoading(false);
  }

  return (
    <div className="card">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Connexion</h1>
        <p className="mt-1 text-sm text-gray-500">
          Accédez à votre espace de gestion
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-field"
            placeholder="votre@email.com"
            required
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            Mot de passe
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-field"
            placeholder="••••••••"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="btn-primary w-full py-3"
        >
          {loading ? "Connexion en cours..." : "Se connecter"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Pas encore de compte ?{" "}
        <Link
          href="/register"
          className="font-medium text-blue-600 hover:underline"
        >
          Créer un compte
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="card text-center text-gray-400">Chargement...</div>}>
      <LoginForm />
    </Suspense>
  );
}