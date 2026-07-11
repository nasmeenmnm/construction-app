"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function Home() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push("/dashboard"); 
    }
  };

  return (
    // Deep black/zinc background for a premium feel
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
      
      {/* White card with a bold red accent line at the top */}
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="h-2 w-full bg-red-600"></div>
        
        <div className="p-8">
          <div className="mb-8 text-center">
            {/* Stylized Brand Header */}
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">
              COMPANY<span className="text-red-600">PORTAL</span>
            </h1>
            <p className="mt-2 text-sm text-zinc-500">Secure Money Flow Management</p>
          </div>

          {error && (
            <div className="mb-6 rounded-md border-l-4 border-red-600 bg-red-50 p-4 text-sm font-medium text-red-800">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-zinc-900">Email</label>
              <input 
                type="email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1.5 w-full rounded-md border border-zinc-300 bg-zinc-50 p-2.5 text-zinc-900 transition-colors focus:border-red-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-red-600"
                placeholder="you@company.com"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-zinc-900">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="mt-1.5 w-full rounded-md border border-zinc-300 bg-zinc-50 p-2.5 text-zinc-900 transition-colors focus:border-red-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-red-600"
                placeholder="••••••••"
              />
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="mt-4 w-full rounded-md bg-red-600 py-3 text-sm font-bold uppercase tracking-wide text-white transition-all hover:bg-red-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 disabled:opacity-70"
            >
              {loading ? "Authenticating..." : "Secure Sign In"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}