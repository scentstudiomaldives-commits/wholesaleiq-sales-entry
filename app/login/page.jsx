"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabaseClient";

const C = {
  navy: "#0B2E52", blue: "#1F6FEB", line: "#E4EAF2", text: "#0B2036", muted: "#8B99AC", red: "#D5433C",
};

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password });
    if (authError) { setError("Incorrect email or password."); setLoading(false); return; }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    router.push(profile?.role === "admin" ? "/admin" : "/entry");
    router.refresh();
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <form onSubmit={handleLogin} style={{ width: 360, maxWidth: "100%", background: "#fff", border: `1px solid ${C.line}`, borderRadius: 16, padding: "32px 28px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 24 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: C.blue, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Manrope", fontWeight: 800, color: "#fff" }}>W</div>
          <div>
            <div style={{ fontFamily: "Manrope", fontWeight: 800, fontSize: 15, color: C.text }}>WholesaleIQ</div>
            <div style={{ fontSize: 10.5, color: C.muted, fontWeight: 600 }}>SALES ENTRY LOGIN</div>
          </div>
        </div>

        <label style={{ fontSize: 12, fontWeight: 700, color: C.text, display: "block", marginBottom: 6 }}>Email</label>
        <input
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: `1px solid ${C.line}`, marginBottom: 16, fontSize: 14, fontFamily: "Inter" }}
          placeholder="you@sto.mv"
        />
        <label style={{ fontSize: 12, fontWeight: 700, color: C.text, display: "block", marginBottom: 6 }}>Password</label>
        <input
          type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: "10px 12px", borderRadius: 9, border: `1px solid ${C.line}`, marginBottom: 20, fontSize: 14, fontFamily: "Inter" }}
          placeholder="••••••••"
        />
        {error && <div style={{ color: C.red, fontSize: 12.5, fontWeight: 600, marginBottom: 14 }}>{error}</div>}
        <button
          type="submit" disabled={loading}
          style={{ width: "100%", padding: "11px", borderRadius: 9, border: "none", background: C.blue, color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer", opacity: loading ? 0.7 : 1 }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
        <div style={{ fontSize: 11, color: C.muted, marginTop: 16, textAlign: "center", lineHeight: 1.5 }}>
          Accounts are created by your admin. Contact your manager if you don't have a login yet.
        </div>
      </form>
    </div>
  );
}
