import React, { useState } from 'react';
import { setGasUrl } from '../utils/gasStore';

export default function SetupScreen({ onDone }) {
  const [url, setUrl]   = useState("");
  const [err, setErr]   = useState("");
  const [testing, setTesting] = useState(false);

  const handleSave = async () => {
    const trimmed = url.trim();
    if (!trimmed.startsWith("https://script.google.com/macros/s/")) {
      setErr("URL không hợp lệ — phải bắt đầu bằng https://script.google.com/macros/s/");
      return;
    }
    setTesting(true); setErr("");
    try {
      const resp = await fetch(trimmed + "?action=ping");
      const data = await resp.json();
      if (!data.ok && data.error !== "Unauthorized") throw new Error(data.error || "GAS không phản hồi đúng");
      setGasUrl(trimmed);
      onDone();
    } catch(e) {
      setErr("Không kết nối được GAS: " + e.message + ". Kiểm tra lại URL và quyền truy cập (Anyone).");
    } finally { setTesting(false); }
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--bg-app)", padding:16 }}>
      <div style={{ background:"var(--bg-card)", borderRadius:16, padding:"36px 40px", maxWidth:520, width:"100%", boxShadow:"var(--shadow-xl)" }}>
        <div style={{ fontSize:32, marginBottom:8 }}>🚀</div>
        <div style={{ fontWeight:700, fontSize:20, color:"var(--primary)", marginBottom:6 }}>Thiết lập lần đầu</div>
        <p style={{ color:"var(--text-muted)", fontSize:13, marginBottom:24, lineHeight:1.7 }}>
          Chào mừng! Để bắt đầu, hãy nhập URL Google Apps Script Web App của bạn.
          URL này kết nối app với dữ liệu của công ty trên Google Drive.
        </p>

        <div style={{ background:"var(--border-light)", border:"1px solid var(--border-color)", borderRadius:8, padding:"12px 14px", marginBottom:20, fontSize:12, color:"var(--text-muted)", lineHeight:1.7 }}>
          <b>Cách lấy URL:</b><br/>
          1. Mở <a href="https://script.google.com" target="_blank" style={{color:"var(--accent)"}} rel="noreferrer">script.google.com</a> → mở project GAS của bạn<br/>
          2. Deploy → Manage deployments → chọn deployment → copy URL<br/>
          3. URL có dạng: <code style={{background:"var(--border-light)",padding:"1px 4px",borderRadius:3}}>https://script.google.com/macros/s/.../exec</code>
        </div>


        <div className="form-group">
          <label>GAS Web App URL</label>
          <input className="form-control" value={url} onChange={e => { setUrl(e.target.value); setErr(""); }}
            placeholder="https://script.google.com/macros/s/.../exec"
            onKeyDown={e => e.key === "Enter" && handleSave()} autoFocus />
        </div>

        {err && <div style={{ color:"#dc2626", fontSize:12, marginBottom:12, padding:"8px 12px", background:"#fee2e2", borderRadius:6 }}>{err}</div>}

        <button className="btn btn-primary" style={{ width:"100%", marginTop:4, justifyContent:"center" }}
          onClick={handleSave} disabled={testing || !url.trim()}>
          {testing ? "⏳ Đang kiểm tra kết nối..." : "✅ Kết nối & bắt đầu"}
        </button>

        <button className="btn btn-ghost" style={{ width:"100%", marginTop:10, justifyContent:"center", color:"var(--accent)", border:"1px solid var(--border-color)" }}
          onClick={() => onDone()}>
          ⚡ Bỏ qua & Sử dụng Supabase Cloud Database
        </button>
      </div>
    </div>
  );
}
