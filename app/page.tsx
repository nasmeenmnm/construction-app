"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard");
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setError("Please enter your email address first.");
      return;
    }
    setLoading(true);
    setError(null);
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/update-password`,
    });

    if (error) {
      setError(error.message);
    } else {
      setMessage("Password reset link sent! Check your email.");
    }
    setLoading(false);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="h-2 w-full bg-red-600"></div>
        <div className="p-8">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">
              COMPANY<span className="text-red-600">PORTAL</span>
            </h1>
            <p className="mt-2 text-sm text-zinc-500">Secure Money Flow Management</p>
          </div>

          {error && <div className="mb-6 rounded-md bg-red-50 p-4 text-sm text-red-800">{error}</div>}
          {message && <div className="mb-6 rounded-md bg-green-50 p-4 text-sm text-green-800">{message}</div>}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-zinc-900">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="mt-1.5 w-full rounded-md border p-2.5 text-zinc-900 focus:border-red-600 focus:outline-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-zinc-900">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="mt-1.5 w-full rounded-md border p-2.5 text-zinc-900 focus:border-red-600 focus:outline-none" />
            </div>
            
            <div className="flex justify-end">
              <button type="button" onClick={handleForgotPassword} className="text-sm font-medium text-red-600 hover:text-red-500">
                Forgot Password?
              </button>
            </div>

            <button type="submit" disabled={loading} className="w-full rounded-md bg-red-600 py-3 font-bold text-white transition-all hover:bg-red-700">
              {loading ? "PROCESSING..." : "SECURE SIGN IN"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}