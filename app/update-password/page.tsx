"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function UpdatePassword() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/");
      } else {
        // FIX: Added the fallback to satisfy TypeScript
        setUserEmail(user.email ?? "Unknown Email");
      }
    };
    checkUser();
  }, [router, supabase]);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      return setError("Passwords do not match.");
    }
    if (newPassword.length < 6) {
      return setError("Password must be at least 6 characters.");
    }

    setLoading(true);

    try {
      // 1. Update the password
      const { error: authError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (authError) throw authError;

      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
         // 2. Flip the security flag (Now this will actually work!)
         const { error: profileError } = await supabase
           .from('profiles')
           .update({ is_first_login: false })
           .eq('id', user.id);

         if (profileError) throw profileError;
      }

      // 3. Force a hard navigation to the dashboard
      window.location.href = "/dashboard";

    } catch (err: any) {
      setError(err.message || "Failed to update password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="h-2 w-full bg-red-600"></div>
        
        <div className="p-8">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900">
              SECURE<span className="text-red-600">SETUP</span>
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              Please set a permanent password for <br/>
              <span className="font-semibold text-zinc-800">{userEmail}</span>
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-md border-l-4 border-red-600 bg-red-50 p-4 text-sm font-medium text-red-800">
              {error}
            </div>
          )}

          <form onSubmit={handleUpdatePassword} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-zinc-900">New Password</label>
              <input 
                type="password" 
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
                className="mt-1.5 w-full rounded-md border border-zinc-300 bg-zinc-50 p-2.5 text-zinc-900 transition-colors focus:border-red-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-red-600"
                placeholder="Minimum 6 characters"
              />
            </div>
            
            <div>
              <label className="block text-sm font-semibold text-zinc-900">Confirm Password</label>
              <input 
                type="password" 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="mt-1.5 w-full rounded-md border border-zinc-300 bg-zinc-50 p-2.5 text-zinc-900 transition-colors focus:border-red-600 focus:bg-white focus:outline-none focus:ring-1 focus:ring-red-600"
                placeholder="Re-type new password"
              />
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="mt-4 w-full rounded-md bg-red-600 py-3 text-sm font-bold uppercase tracking-wide text-white transition-all hover:bg-red-700 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-red-600 focus:ring-offset-2 disabled:opacity-70"
            >
              {loading ? "Updating..." : "Save & Continue"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}