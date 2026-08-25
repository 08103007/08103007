import React, { useState } from 'react';
import { getLogoUrl, COMPANY, doLogin } from '../utils/gasStore';

export default function LoginScreen({ onLogin }) {
  const [pw, setPw]         = useState("");
  const [err, setErr]       = useState("");
  const [show, setShow]     = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!pw.trim()) return;
    setLoading(true);
    setErr("");
    try {
      await doLogin(pw);   
      onLogin();
    } catch(e) {
      setErr(e.message || "Mật khẩu không đúng");
      setPw("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--bg-app)" }}>
      <div className="login-card" style={{ background:"var(--bg-card)", borderRadius:16, padding:"40px 48px", boxShadow:"var(--shadow-xl)", minWidth:340, textAlign:"center" }}>
        <img src={getLogoUrl()} style={{ width:64, height:64, objectFit:"contain", marginBottom:16 }} alt="PMC" />
        <div style={{ fontWeight:700, fontSize:18, color:"var(--primary)", marginBottom:4 }}>{COMPANY.short}</div>
        <div style={{ fontSize:12, color:"var(--text-muted)", marginBottom:28 }}>Quản lý báo giá – Đăng nhập để tiếp tục</div>


        <div style={{ position:"relative", marginBottom:12 }}>
          <input
            type={show ? "text" : "password"}
            className="form-control"
            placeholder="Nhập mật khẩu..."
            value={pw}
            autoComplete="new-password"
            onChange={e => setPw(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
            autoFocus
            style={{ paddingRight:40, textAlign:"center", letterSpacing:"0.15em" }}
          />
          <button
            onClick={() => setShow(s => !s)}
            style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)", background:"none", border:"none", cursor:"pointer", color:"#999", fontSize:16 }}
          >{show ? "🙈" : "👁️"}</button>
        </div>

        {err && <div style={{ color:"#dc2626", fontSize:12, marginBottom:10 }}>{err}</div>}

        <button className="btn btn-primary" style={{ width:"100%", marginTop:4 }} onClick={handleSubmit} disabled={loading}>
          {loading ? "⏳ Đang xác thực..." : "Đăng nhập"}
        </button>

        <div style={{ fontSize:11, color:"#bbb", marginTop:20 }}>
          {COMPANY.name}
        </div>
      </div>
    </div>
  );
}
