import React, { useState, useRef, useEffect } from 'react';
import { 
  COMPANY, getGasUrl, setGasUrl, logout, PRODUCT_CATALOG, 
  CONTRACT_DEFAULTS, LS_TOKEN, LS_GAS_URL,
  exportToJSON, importFromJSON, recoverEmergencyBackup,
  initLocalFileHandle, getCurrentFileHandle, selectAndBindLocalJsonFile,
  createAndBindLocalJsonFile, disconnectLocalJsonFile, readFromLocalJsonFile,
  writeToLocalJsonFile, _mem,
  getLS, removeLS, getAppPrefix, setAppPrefix,
  compareLocalAndGAS, applyReconciledQuotes
} from '../utils/gasStore';
import { 
  getSupabaseUrl, setSupabaseUrl, getSupabaseKey, setSupabaseKey, 
  testSupabaseConnection, SUPABASE_SQL_SCHEMA 
} from '../utils/supabaseClient';

const DEFAULT_COMPANY = {
  name:"", nameEn:"", short:"", mst:"", address:"", addressEn:"",
  phone:"", email:"", representative:"", representativeEn:"",
  position:"Giám Đốc", positionEn:"Director",
  bankAccount:"", bankName:"", bankNameEn:"", logo:"",
};

export default function SettingsView({ onCompanyUpdate, onQuotesImport }) {
  const [company,  setCompany]  = useState({ ...DEFAULT_COMPANY, ...COMPANY });
  const [gasUrl,   setGasUrlS]  = useState(getGasUrl());
  const [sbUrl,    setSbUrlS]   = useState(getSupabaseUrl());
  const [sbKey,    setSbKeyS]   = useState(getSupabaseKey());
  const [sbTestMsg, setSbTestMsg] = useState("");
  const [saving,   setSaving]   = useState(false);
  const [testMsg,  setTestMsg]  = useState("");

  const handleTestSb = async () => {
    setSbTestMsg("⏳ Đang kết nối Supabase...");
    try {
      setSupabaseUrl(sbUrl.trim());
      setSupabaseKey(sbKey.trim());
      await testSupabaseConnection();
      setSbTestMsg("⚡ Kết nối Supabase PostgreSQL thành công! (~30ms)");
    } catch(err) {
      setSbTestMsg("❌ Lỗi: " + err.message);
    }
  };
  const [saveMsg,  setSaveMsg]  = useState("");
  const [logoPreview, setLogoPreview] = useState(COMPANY.logo || "");
  const fileRef = useRef(null);

  const cd = (CONTRACT_DEFAULTS && CONTRACT_DEFAULTS.vi_en) || {};
  const [deliveryDays,  setDeliveryDays]  = useState(cd.deliveryDays  || "05");
  const [paymentTerm,   setPaymentTerm]   = useState(cd.paymentTerm   || "thanh toán 100% giá trị hợp đồng sau khi bàn giao và lắp đặt thiết bị.");
  const [paymentTermEn, setPaymentTermEn] = useState(cd.paymentTermEn || "Pay 100% of the contract value after handover and installation of the equipment.");

  const [quickCatalog, setQuickCatalog] = useState(PRODUCT_CATALOG.join("\n"));

  const [currentPw,  setCurrentPw]  = useState("");
  const [newPw,      setNewPw]      = useState("");
  const [confirmPw,  setConfirmPw]  = useState("");
  const [newSecret,  setNewSecret]  = useState("");
  const [credMsg,    setCredMsg]    = useState("");
  const [credSaving, setCredSaving] = useState(false);
  const [showPw,     setShowPw]     = useState(false);

  const [fileHandle, setFileHandle] = useState(getCurrentFileHandle());
  const [fileSyncMsg, setFileSyncMsg] = useState("");
  const [appPrefixVal, setAppPrefixVal] = useState(getAppPrefix());

  const [reconLoading, setReconLoading] = useState(false);
  const [reconReport, setReconReport] = useState(null);
  const [reconError, setReconError] = useState("");

  const handleRunReconciliation = async () => {
    setReconLoading(true);
    setReconError("");
    setReconReport(null);
    try {
      const report = await compareLocalAndGAS();
      setReconReport(report);
    } catch (err) {
      setReconError(err.message || "Lỗi đối chiếu dữ liệu");
    } finally {
      setReconLoading(false);
    }
  };

  const handleApplyReconciliation = async () => {
    if (!reconReport || !reconReport.masterQuotes) return;
    if (!window.confirm(`Hợp nhất & Đồng bộ đầy đủ ${reconReport.masterQuotes.length} báo giá lên cả Local và Google Drive?`)) return;
    try {
      setReconLoading(true);
      const res = await applyReconciledQuotes(reconReport.masterQuotes);
      setReconReport(null);
      if (typeof onQuotesImport === "function") {
        onQuotesImport(res);
      }
    } catch (err) {
      alert("Lỗi hợp nhất: " + err.message);
    } finally {
      setReconLoading(false);
    }
  };

  const handleSavePrefix = () => {
    const clean = appPrefixVal.replace(/[^a-zA-Z0-9_-]/g, "").trim();
    if (!clean) {
      alert("Mã định danh không được để trống!");
      return;
    }
    if (window.confirm(`Đổi Mã định danh App thành "${clean}"?\nApp sẽ khởi động lại với không gian lưu trữ hoàn toàn độc lập.`)) {
      setAppPrefix(clean);
    }
  };

  useEffect(() => {
    initLocalFileHandle().then(h => setFileHandle(h));
  }, []);

  const handleSelectLocalJson = async () => {
    try {
      setFileSyncMsg("⏳ Đang kết nối...");
      const h = await selectAndBindLocalJsonFile();
      setFileHandle(h);
      if (typeof onQuotesImport === "function") onQuotesImport([..._mem.quotes]);
      setFileSyncMsg(`✅ Đã kết nối với file: ${h ? h.name : ""}`);
    } catch (e) {
      if (e.name !== "AbortError") setFileSyncMsg(`❌ ${e.message}`);
      else setFileSyncMsg("");
    }
  };

  const handleCreateLocalJson = async () => {
    try {
      setFileSyncMsg("⏳ Đang khởi tạo...");
      const h = await createAndBindLocalJsonFile();
      setFileHandle(h);
      setFileSyncMsg(`✅ Đã tạo & kết nối file: ${h ? h.name : ""}`);
    } catch (e) {
      if (e.name !== "AbortError") setFileSyncMsg(`❌ ${e.message}`);
      else setFileSyncMsg("");
    }
  };

  const handleReadLocalJson = async () => {
    setFileSyncMsg("⏳ Đang đọc file...");
    const ok = await readFromLocalJsonFile();
    if (ok) {
      if (typeof onQuotesImport === "function") onQuotesImport([..._mem.quotes]);
      setFileSyncMsg("✅ Đã nạp dữ liệu từ file JSON thành công!");
    } else {
      setFileSyncMsg("❌ Không đọc được file (vui lòng kiểm tra quyền truy cập)");
    }
  };

  const handleWriteLocalJson = async () => {
    setFileSyncMsg("⏳ Đang ghi file...");
    const ok = await writeToLocalJsonFile();
    if (ok) {
      setFileSyncMsg("✅ Đã ghi toàn bộ dữ liệu vào file JSON thành công!");
    } else {
      setFileSyncMsg("❌ Không ghi được file (vui lòng cấp quyền)");
    }
  };

  const handleDisconnectLocalJson = async () => {
    await disconnectLocalJsonFile();
    setFileHandle(null);
    setFileSyncMsg("🔌 Đã hủy kết nối file JSON.");
  };



  const setC = (f, v) => setCompany(p => ({ ...p, [f]: v }));

  const handleChangeCredentials = async () => {
    if (!currentPw) { setCredMsg("❌ Nhập mật khẩu hiện tại"); return; }
    if (newPw && newPw.length < 6) { setCredMsg("❌ Mật khẩu mới phải ít nhất 6 ký tự"); return; }
    if (newPw && newPw !== confirmPw) { setCredMsg("❌ Mật khẩu mới không khớp"); return; }
    if (newSecret && newSecret.length < 8) { setCredMsg("❌ API Secret phải ít nhất 8 ký tự"); return; }
    if (!newPw && !newSecret) { setCredMsg("❌ Nhập mật khẩu mới hoặc API Secret mới"); return; }
    setCredSaving(true); setCredMsg("");
    try {
      const token = getLS(LS_TOKEN) || "";
      const resp = await fetch(getGasUrl(), {
        method: "POST",
        body: JSON.stringify({ token, action: "change_credentials", payload: {
          currentPassword: currentPw,
          newPassword: newPw || undefined,
          newSecret:   newSecret || undefined,
        }}),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error);
      setCredMsg("✅ Đã đổi thành công! Đang đăng xuất...");
      setCurrentPw(""); setNewPw(""); setConfirmPw(""); setNewSecret("");
      setTimeout(() => logout(), 2000);
    } catch(e) {
      setCredMsg("❌ " + e.message);
    } finally { setCredSaving(false); }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setLogoPreview(ev.target.result); setC("logo", ev.target.result); };
    reader.readAsDataURL(file);
  };

  const handleTestGas = async () => {
    setTestMsg("⏳ Đang kiểm tra...");
    try {
      const resp = await fetch(gasUrl.trim() + "?action=ping");
      const data = await resp.json();
      setTestMsg(data.ok || data.error === "Unauthorized" ? "✅ Kết nối thành công!" : "❌ " + (data.error || "Lỗi không xác định"));
    } catch(e) { setTestMsg("❌ Không kết nối được: " + e.message); }
    setTimeout(() => setTestMsg(""), 4000);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      setGasUrl(gasUrl.trim());
      const token = getLS(LS_TOKEN) || "";
      const resp = await fetch(getGasUrl(), {
        method: "POST",
        body: JSON.stringify({ token, action: "save_settings", payload: {
          company,
          contractDefaults: {
            vi_en: {
              deliveryDays:    deliveryDays,
              deliveryPlace:   "",
              deliveryPlaceEn: "",
              paymentTerm:     paymentTerm,
              paymentTermEn:   paymentTermEn,
            }
          },
          productCatalog: quickCatalog.split("\n").map(s=>s.trim()).filter(Boolean),
        }}),
      });
      const data = await resp.json();
      if (!data.ok) throw new Error(data.error);
      Object.assign(COMPANY, company);
      if (!CONTRACT_DEFAULTS.vi_en) CONTRACT_DEFAULTS.vi_en = {};
      Object.assign(CONTRACT_DEFAULTS.vi_en, { deliveryDays, paymentTerm, paymentTermEn });
      const newCatalog = quickCatalog.split("\n").map(s=>s.trim()).filter(Boolean);
      PRODUCT_CATALOG.splice(0, PRODUCT_CATALOG.length, ...newCatalog);
      setSaveMsg("✅ Đã lưu");
      setTimeout(() => setSaveMsg(""), 2500);
      if (typeof onCompanyUpdate === "function") onCompanyUpdate({ ...company });
    } catch(e) {
      setSaveMsg("❌ Lỗi: " + e.message);
      setTimeout(() => setSaveMsg(""), 4000);
    } finally { setSaving(false); }
  };

  return (
    <div>
      <div style={{ marginBottom:20, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
        <div>
          <h2 style={{ fontSize:18, fontWeight:600, color:"#1a2540", marginBottom:4 }}>⚙️ Cài đặt hệ thống</h2>
          <p style={{ color:"#888", fontSize:13 }}>Thông tin công ty sẽ hiển thị trên báo giá, hợp đồng, biên bản</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? "⏳ Đang lưu..." : "💾 Lưu cài đặt"}{saveMsg && <span style={{marginLeft:8,fontSize:12}}>{saveMsg}</span>}
        </button>
      </div>

      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-header"><span style={{fontWeight:600}}>🔗 Kết nối Google Apps Script</span></div>
        <div className="card-body">
          <div className="form-group">
            <label>GAS Web App URL</label>
            <div style={{ display:"flex", gap:8 }}>
              <input className="form-control" value={gasUrl} onChange={e => { setGasUrlS(e.target.value); setTestMsg(""); }}
                placeholder="https://script.google.com/macros/s/.../exec" style={{ flex:1 }} />
              <button className="btn btn-ghost" onClick={handleTestGas} style={{ whiteSpace:"nowrap" }}>🔌 Kiểm tra</button>
            </div>
            {testMsg && <div style={{ marginTop:6, fontSize:12, color: testMsg.startsWith("✅") ? "#16a34a" : testMsg.startsWith("⏳") ? "#888" : "#dc2626" }}>{testMsg}</div>}
            <div style={{ fontSize:11, color:"#aaa", marginTop:4 }}>URL này được lưu trong trình duyệt. Mỗi máy/thiết bị cần nhập 1 lần.</div>
          </div>
        </div>
      </div>

      {/* Supabase Database Connection Card */}
      <div className="card" style={{ marginBottom:16, borderColor:"#10b981" }}>
        <div className="card-header" style={{ background:"#ecfdf5", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{fontWeight:600, color:"#047857"}}>⚡ Kết nối Supabase Cloud Database (PostgreSQL - Siêu Tốc ~30ms)</span>
          <button className="btn btn-ghost btn-sm" style={{color:"#047857", fontWeight:600}} onClick={() => { navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA); alert("✅ Đã coppy SQL Mẫu vào Clipboard! Hãy dán vào Supabase SQL Editor."); }}>
            📋 Coppy SQL Mẫu
          </button>
        </div>
        <div className="card-body">
          <div style={{fontSize:12, color:"#475569", marginBottom:12, lineHeight:1.6}}>
            Supabase cung cấp cơ sở dữ liệu PostgreSQL siêu tốc miễn phí, giúp lưu & đồng bộ báo giá tức thì trong 30ms.
          </div>
          <div className="form-group" style={{marginBottom:10}}>
            <label>Supabase Project URL</label>
            <input className="form-control" value={sbUrl} onChange={e => { setSbUrlS(e.target.value); setSupabaseUrl(e.target.value); setSbTestMsg(""); }}
              placeholder="https://xyzxyz.supabase.co" />
          </div>
          <div className="form-group" style={{marginBottom:10}}>
            <label>Supabase Anon Key (Public Key)</label>
            <input className="form-control" type="password" value={sbKey} onChange={e => { setSbKeyS(e.target.value); setSupabaseKey(e.target.value); setSbTestMsg(""); }}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." />
          </div>
          <div style={{display:"flex", gap:10, alignItems:"center"}}>
            <button className="btn btn-primary btn-sm" onClick={handleTestSb}>🔌 Kiểm tra kết nối Supabase</button>
            {sbTestMsg && <span style={{fontSize:12, color: sbTestMsg.startsWith("⚡") ? "#16a34a" : sbTestMsg.startsWith("⏳") ? "#888" : "#dc2626"}}>{sbTestMsg}</span>}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-header"><span style={{fontWeight:600}}>🏢 Logo công ty</span></div>
        <div className="card-body">
          <div style={{ display:"flex", alignItems:"center", gap:16 }}>
            <div style={{ width:80, height:80, border:"1px solid #e5e3dc", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", background:"#f9f8f5", overflow:"hidden", flexShrink:0 }}>
              {logoPreview ? <img src={logoPreview} alt="Logo" style={{ width:"100%", height:"100%", objectFit:"contain" }} /> : <span style={{ fontSize:28, color:"#ddd" }}>🏢</span>}
            </div>
            <div>
              <button className="btn btn-ghost btn-sm" onClick={() => fileRef.current && fileRef.current.click()}>📁 Chọn logo</button>
              {logoPreview && <button className="btn btn-ghost btn-sm" style={{ marginLeft:8, color:"#dc2626" }} onClick={() => { setLogoPreview(""); setC("logo",""); }}>✕ Xóa</button>}
              <div style={{ fontSize:11, color:"#aaa", marginTop:4 }}>PNG, JPG — nên dùng ảnh vuông, nền trắng</div>
              <input ref={fileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleLogoUpload} />
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-header"><span style={{fontWeight:600}}>📋 Thông tin công ty</span></div>
        <div className="card-body">
          <div className="form-row form-row-2" style={{ marginBottom:12 }}>
            <div className="form-group">
              <label>Tên công ty (Tiếng Việt)</label>
              <input className="form-control" value={company.name} onChange={e => setC("name", e.target.value)} placeholder="CÔNG TY TNHH ABC" />
            </div>
            <div className="form-group">
              <label>Tên công ty (English)</label>
              <input className="form-control" value={company.nameEn} onChange={e => setC("nameEn", e.target.value)} placeholder="ABC CO., LTD" />
            </div>
          </div>
          <div className="form-row form-row-2" style={{ marginBottom:12 }}>
            <div className="form-group">
              <label>Tên viết tắt / thương hiệu</label>
              <input className="form-control" value={company.short} onChange={e => setC("short", e.target.value)} placeholder="ABC" />
            </div>
            <div className="form-group">
              <label>Mã số thuế</label>
              <input className="form-control" value={company.mst} onChange={e => setC("mst", e.target.value)} placeholder="0123456789" />
            </div>
          </div>
          <div className="form-row form-row-2" style={{ marginBottom:12 }}>
            <div className="form-group">
              <label>Địa chỉ (Tiếng Việt)</label>
              <input className="form-control" value={company.address} onChange={e => setC("address", e.target.value)} placeholder="Số 1, Đường ABC, Quận 1, TP.HCM" />
            </div>
            <div className="form-group">
              <label>Địa chỉ (English)</label>
              <input className="form-control" value={company.addressEn} onChange={e => setC("addressEn", e.target.value)} placeholder="No.1 ABC Street, District 1, HCMC" />
            </div>
          </div>
          <div className="form-row form-row-3" style={{ marginBottom:12 }}>
            <div className="form-group">
              <label>Điện thoại</label>
              <input className="form-control" value={company.phone} onChange={e => setC("phone", e.target.value)} placeholder="0909 123 456" />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input className="form-control" value={company.email} onChange={e => setC("email", e.target.value)} placeholder="info@abc.com" />
            </div>
            <div className="form-group">
              <label>Website (tùy chọn)</label>
              <input className="form-control" value={company.website||""} onChange={e => setC("website", e.target.value)} placeholder="www.abc.com" />
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-header"><span style={{fontWeight:600}}>👤 Người đại diện pháp lý</span></div>
        <div className="card-body">
          <div className="form-row form-row-2" style={{ marginBottom:12 }}>
            <div className="form-group">
              <label>Họ tên (Tiếng Việt)</label>
              <input className="form-control" value={company.representative} onChange={e => setC("representative", e.target.value)} placeholder="NGUYỄN VĂN A" />
            </div>
            <div className="form-group">
              <label>Họ tên (English)</label>
              <input className="form-control" value={company.representativeEn} onChange={e => setC("representativeEn", e.target.value)} placeholder="Mr. NGUYEN VAN A" />
            </div>
          </div>
          <div className="form-row form-row-2">
            <div className="form-group">
              <label>Chức vụ (Tiếng Việt)</label>
              <input className="form-control" value={company.position} onChange={e => setC("position", e.target.value)} placeholder="Giám Đốc" />
            </div>
            <div className="form-group">
              <label>Chức vụ (English)</label>
              <input className="form-control" value={company.positionEn} onChange={e => setC("positionEn", e.target.value)} placeholder="Director" />
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-header"><span style={{fontWeight:600}}>🏦 Tài khoản ngân hàng</span></div>
        <div className="card-body">
          <div className="form-row form-row-3">
            <div className="form-group">
              <label>Số tài khoản</label>
              <input className="form-control" value={company.bankAccount} onChange={e => setC("bankAccount", e.target.value)} placeholder="0123456789" />
            </div>
            <div className="form-group">
              <label>Tên ngân hàng (Tiếng Việt)</label>
              <input className="form-control" value={company.bankName} onChange={e => setC("bankName", e.target.value)} placeholder="Ngân hàng TMCP ABC" />
            </div>
            <div className="form-group">
              <label>Tên ngân hàng (English)</label>
              <input className="form-control" value={company.bankNameEn} onChange={e => setC("bankNameEn", e.target.value)} placeholder="ABC Commercial Bank" />
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-header"><span style={{fontWeight:600}}>📃 Điều khoản hợp đồng mặc định</span></div>
        <div className="card-body">
          <div className="form-row form-row-2" style={{ marginBottom:12 }}>
            <div className="form-group">
              <label>Số ngày giao hàng mặc định</label>
              <input className="form-control" value={deliveryDays} onChange={e => setDeliveryDays(e.target.value)} placeholder="05" />
            </div>
          </div>
          <div className="form-group" style={{ marginBottom:12 }}>
            <label>Điều khoản thanh toán mặc định (Tiếng Việt)</label>
            <textarea className="form-control" rows={2} value={paymentTerm} onChange={e => setPaymentTerm(e.target.value)} />
          </div>
          <div className="form-group">
            <label>Điều khoản thanh toán mặc định (English)</label>
            <textarea className="form-control" rows={2} value={paymentTermEn} onChange={e => setPaymentTermEn(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-header">
          <span style={{fontWeight:600}}>📦 Danh sách sản phẩm gợi ý nhanh</span>
          <span style={{fontSize:11,color:"#888"}}>Mỗi dòng 1 tên sản phẩm — hiển thị khi gợi ý tự động</span>
        </div>
        <div className="card-body">
          <textarea className="form-control" rows={8}
            value={quickCatalog}
            onChange={e => setQuickCatalog(e.target.value)}
            placeholder={"Máy in HP LaserJet Pro M209dw\nHộp mực in HP CF276A\nCáp USB 3.0 1.5m\n..."} />
          <div style={{fontSize:11,color:"#aaa",marginTop:4}}>
            {quickCatalog.split("\n").filter(s=>s.trim()).length} sản phẩm
          </div>
        </div>
      </div>

      {/* Direct PC Local JSON File Sync Card */}
      <div className="card" style={{ marginBottom:16, borderColor: fileHandle ? "#2563eb" : undefined }}>
        <div className="card-header" style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{fontWeight:600}}>💻 Đọc & Ghi trực tiếp file JSON trên PC (Local File Sync)</span>
          {fileHandle && <span style={{fontSize:11, background:"#dcfce7", color:"#166534", padding:"2px 8px", borderRadius:12, fontWeight:600}}>● Đang kết nối file</span>}
        </div>
        <div className="card-body">
          <div style={{fontSize:12, color:"#64748b", marginBottom:12, lineHeight:1.6}}>
            Tính năng cho phép ứng dụng tự động đồng bộ & lưu dữ liệu trực tiếp vào một file <code>.json</code> nằm trên đĩa cứng PC của bạn (Ví dụ: <code>D:\data\baogia_pmc.json</code>).
          </div>

          {fileHandle ? (
            <div style={{background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:8, padding:"12px 14px", marginBottom:12}}>
              <div style={{fontSize:13, fontWeight:700, color:"#166534", marginBottom:4}}>
                📄 File đang liên kết: <span style={{fontFamily:"monospace"}}>{fileHandle.name}</span>
              </div>
              <div style={{fontSize:11, color:"#15803d", marginBottom:10}}>
                Tất cả báo giá, biên bản, hợp đồng sẽ tự động ghi vào file này mỗi khi bạn lưu.
              </div>
              <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleReadLocalJson}>
                  🔄 Đọc dữ liệu từ file
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleWriteLocalJson}>
                  💾 Ghi ngay vào file
                </button>
                <button type="button" className="btn btn-danger btn-sm" onClick={handleDisconnectLocalJson}>
                  🔌 Hủy liên kết file
                </button>
              </div>
            </div>
          ) : (
            <div style={{background:"#f8fafc", border:"1px dashed #cbd5e1", borderRadius:8, padding:"12px 14px", marginBottom:12}}>
              <div style={{fontSize:12, color:"#475569", marginBottom:10}}>
                Chưa kết nối file JSON nào trên đĩa cứng PC. Bạn có thể chọn file có sẵn hoặc tạo mới file JSON:
              </div>
              <div style={{display:"flex", gap:10, flexWrap:"wrap"}}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleSelectLocalJson}>
                  📂 Chọn file JSON có sẵn trên PC
                </button>
                <button type="button" className="btn btn-primary btn-sm" onClick={handleCreateLocalJson}>
                  ➕ Tạo file JSON mới trên PC
                </button>
              </div>
            </div>
          )}

          {fileSyncMsg && (
            <div style={{fontSize:12, marginTop:6, color: fileSyncMsg.startsWith("✅") ? "#16a34a" : fileSyncMsg.startsWith("⏳") ? "#888" : "#dc2626"}}>
              {fileSyncMsg}
            </div>
          )}
        </div>
      </div>

      {/* Data Comparison & Reconciliation Card */}
      <div className="card" style={{ marginBottom:16, borderColor:"#3b82f6" }}>
        <div className="card-header" style={{ background:"#eff6ff", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{fontWeight:600, color:"#1d4ed8"}}>📊 Đối chiếu & Kiểm tra Chênh lệch Dữ liệu (Local vs Google Drive)</span>
          <button className="btn btn-primary btn-sm" onClick={handleRunReconciliation} disabled={reconLoading}>
            {reconLoading ? "⏳ Đang đối chiếu..." : "🔍 Bắt đầu đối chiếu"}
          </button>
        </div>
        <div className="card-body">
          <div style={{fontSize:12, color:"#475569", marginBottom:12, lineHeight:1.6}}>
            Công cụ tự động so sánh toàn bộ số lượng báo giá trên <b>Máy Local (PC)</b> và <b>Google Drive</b> để phát hiện lệch số lượng, thiếu báo giá hoặc lệch nội dung.
          </div>

          {reconError && (
            <div style={{padding:"8px 12px", background:"#fee2e2", color:"#dc2626", borderRadius:6, fontSize:13, marginBottom:12}}>
              ⚠️ {reconError}
            </div>
          )}

          {reconReport && (
            <div style={{background:"#f8fafc", border:"1px solid #e2e8f0", borderRadius:8, padding:14}}>
              <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(140px, 1fr))", gap:10, marginBottom:14}}>
                <div style={{background:"#fff", padding:"10px 12px", borderRadius:6, border:"1px solid #cbd5e1", textAlign:"center"}}>
                  <div style={{fontSize:11, color:"#64748b"}}>Local Máy PC</div>
                  <div style={{fontSize:18, fontWeight:700, color:"#2563eb"}}>{reconReport.localCount}</div>
                </div>
                <div style={{background:"#fff", padding:"10px 12px", borderRadius:6, border:"1px solid #cbd5e1", textAlign:"center"}}>
                  <div style={{fontSize:11, color:"#64748b"}}>Google Drive</div>
                  <div style={{fontSize:18, fontWeight:700, color:"#0891b2"}}>{reconReport.gasCount}</div>
                </div>
                <div style={{background:"#fff", padding:"10px 12px", borderRadius:6, border:"1px solid #cbd5e1", textAlign:"center"}}>
                  <div style={{fontSize:11, color:"#64748b"}}>Tổng hợp nhất</div>
                  <div style={{fontSize:18, fontWeight:700, color:"#16a34a"}}>{reconReport.masterCount}</div>
                </div>
                <div style={{background:"#fff", padding:"10px 12px", borderRadius:6, border:"1px solid #cbd5e1", textAlign:"center"}}>
                  <div style={{fontSize:11, color:"#64748b"}}>Chỉ có ở Local</div>
                  <div style={{fontSize:18, fontWeight:700, color:"#ea580c"}}>{reconReport.localOnly.length}</div>
                </div>
                <div style={{background:"#fff", padding:"10px 12px", borderRadius:6, border:"1px solid #cbd5e1", textAlign:"center"}}>
                  <div style={{fontSize:11, color:"#64748b"}}>Chỉ có ở Drive</div>
                  <div style={{fontSize:18, fontWeight:700, color:"#8b5cf6"}}>{reconReport.gasOnly.length}</div>
                </div>
              </div>

              {reconReport.localOnly.length > 0 && (
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:12, fontWeight:600, color:"#ea580c", marginBottom:6}}>
                    🟠 Danh sách báo giá chỉ có trên máy Local (Chưa lên Drive):
                  </div>
                  <div style={{maxHeight:140, overflowY:"auto", fontSize:11, background:"#fff", border:"1px solid #e2e8f0", borderRadius:6, padding:8}}>
                    {reconReport.localOnly.map((q, i) => (
                      <div key={i} style={{padding:"4px 0", borderBottom:"1px dashed #eee", display:"flex", justifyContent:"space-between"}}>
                        <span><b>{q.quoteNumber || "Chưa có số"}</b> — {q.customer}</span>
                        <span style={{color:"#888"}}>{q.date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {reconReport.gasOnly.length > 0 && (
                <div style={{marginBottom:12}}>
                  <div style={{fontSize:12, fontWeight:600, color:"#8b5cf6", marginBottom:6}}>
                    🔵 Danh sách báo giá chỉ có trên Google Drive (Chưa tải về PC):
                  </div>
                  <div style={{maxHeight:140, overflowY:"auto", fontSize:11, background:"#fff", border:"1px solid #e2e8f0", borderRadius:6, padding:8}}>
                    {reconReport.gasOnly.map((q, i) => (
                      <div key={i} style={{padding:"4px 0", borderBottom:"1px dashed #eee", display:"flex", justifyContent:"space-between"}}>
                        <span><b>{q.quoteNumber || "Chưa có số"}</b> — {q.customer}</span>
                        <span style={{color:"#888"}}>{q.date}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{display:"flex", gap:10, marginTop:12}}>
                <button className="btn btn-success btn-sm" onClick={handleApplyReconciliation} disabled={reconLoading}>
                  🔄 Hợp nhất & Đồng bộ 100% ({reconReport.masterCount} báo giá)
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Backup & Restore Data JSON Card */}
      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-header"><span style={{fontWeight:600}}>💾 Sao lưu & Khôi phục dữ liệu (JSON)</span></div>
        <div className="card-body">
          <div style={{fontSize:12,color:"#64748b",marginBottom:14,lineHeight:1.6}}>
            Xuất dữ liệu hiện tại ra file JSON để sao lưu dự phòng, hoặc nhập file JSON đã sao lưu để khôi phục dữ liệu lên trình duyệt/thiết bị này.
          </div>
          <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
            <button
              type="button"
              className="btn btn-ghost"
              title="Xuất toàn bộ dữ liệu ra file .json để backup hoặc chuyển máy"
              onClick={() => exportToJSON()}
            >
              📤 Xuất file JSON (Backup)
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              title="Nhập dữ liệu từ file .json (ghi đè dữ liệu hiện tại)"
              onClick={() => importFromJSON(onQuotesImport)}
            >
              📂 Nhập file JSON (Khôi phục)
            </button>
            <button
              type="button"
              className="btn btn-warning"
              title="Khôi phục lại dữ liệu báo giá khẩn cấp từ bộ nhớ tạm trình duyệt"
              onClick={() => {
                try {
                  const restored = recoverEmergencyBackup();
                  if (onQuotesImport) onQuotesImport(restored);
                  alert(`✅ Đã khôi phục thành công ${restored.length} báo giá từ bản sao lưu khẩn cấp!`);
                } catch(e) {
                  alert("⚠️ " + e.message);
                }
              }}
            >
              🚑 Khôi phục từ Backup Khẩn cấp
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-header"><span style={{fontWeight:600}}>🔐 Đổi mật khẩu & API Secret</span></div>
        <div className="card-body">
          <div style={{fontSize:12,color:"#888",marginBottom:14,lineHeight:1.6}}>
            Mật khẩu dùng để đăng nhập app. API Secret dùng để xác thực giữa app và GAS.
            Sau khi đổi, tất cả thiết bị đang đăng nhập sẽ bị đăng xuất.
          </div>

          <div className="form-group">
            <label>Mật khẩu hiện tại *</label>
            <div style={{position:"relative"}}>
              <input className="form-control" type={showPw?"text":"password"}
                value={currentPw} onChange={e=>setCurrentPw(e.target.value)}
                placeholder="Nhập mật khẩu đang dùng..." style={{paddingRight:40}} />
              <button onClick={()=>setShowPw(s=>!s)} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"#999",fontSize:15}}>
                {showPw?"🙈":"👁️"}
              </button>
            </div>
          </div>

          <div style={{background:"#f9f8f5",borderRadius:8,padding:"12px 14px",marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:600,color:"#555",marginBottom:10}}>Mật khẩu đăng nhập mới (để trống nếu không đổi)</div>
            <div className="form-row form-row-2">
              <div className="form-group" style={{marginBottom:0}}>
                <label>Mật khẩu mới</label>
                <input className="form-control" type={showPw?"text":"password"}
                  value={newPw} onChange={e=>setNewPw(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự" />
              </div>
              <div className="form-group" style={{marginBottom:0}}>
                <label>Xác nhận mật khẩu mới</label>
                <input className="form-control" type={showPw?"text":"password"}
                  value={confirmPw} onChange={e=>setConfirmPw(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới"
                  style={{borderColor: confirmPw && newPw && confirmPw!==newPw ? "#dc2626" : ""}} />
              </div>
            </div>
          </div>

          <div style={{background:"#f9f8f5",borderRadius:8,padding:"12px 14px",marginBottom:14}}>
            <div style={{fontSize:12,fontWeight:600,color:"#555",marginBottom:10}}>API Secret mới (để trống nếu không đổi)</div>
            <div className="form-group" style={{marginBottom:0}}>
              <label>API Secret</label>
              <input className="form-control" type={showPw?"text":"password"}
                value={newSecret} onChange={e=>setNewSecret(e.target.value)}
                placeholder="Tối thiểu 8 ký tự, nên dùng ký tự đặc biệt" />
              <div style={{fontSize:11,color:"#aaa",marginTop:4}}>VD: MyApp@2025!xyz — chuỗi càng phức tạp càng tốt</div>
            </div>
          </div>

          {credMsg && (
            <div style={{padding:"8px 12px",borderRadius:6,marginBottom:12,fontSize:13,
              background: credMsg.startsWith("✅") ? "#dcfce7" : "#fee2e2",
              color: credMsg.startsWith("✅") ? "#166534" : "#dc2626"}}>
              {credMsg}
            </div>
          )}

          <button className="btn btn-primary" onClick={handleChangeCredentials} disabled={credSaving||!currentPw}>
            {credSaving ? "⏳ Đang xử lý..." : "🔐 Đổi credentials"}
          </button>
        </div>
      </div>

      {/* App Instance Namespace / Prefix Card */}
      <div className="card" style={{ marginBottom:16, borderColor:"#cbd5e1" }}>
        <div className="card-header"><span style={{fontWeight:600}}>🏷️ Mã định danh App Instance (Phân biệt khi chạy song song nhiều App)</span></div>
        <div className="card-body">
          <div style={{fontSize:12, color:"#64748b", marginBottom:12, lineHeight:1.6}}>
            Khi bạn clone app ra nhiều folder hoặc chạy song song 2 app trên 1 máy PC, hãy đổi Mã định danh (VD: <code>app1</code>, <code>app2</code>, <code>cty_hanoi</code>, <code>cty_hcm</code>). Dữ liệu local storage & cache file của từng app sẽ được phân lập 100%, hoàn toàn không đụng chạm hay đè lên nhau.
          </div>
          <div className="form-group" style={{marginBottom:10}}>
            <label>Mã định danh hiện tại (App Prefix)</label>
            <div style={{display:"flex", gap:8, maxWidth:400}}>
              <input
                className="form-control"
                value={appPrefixVal}
                onChange={e => setAppPrefixVal(e.target.value)}
                placeholder="VD: app1, app2, cty_a..."
              />
              <button type="button" className="btn btn-secondary btn-sm" style={{whiteSpace:"nowrap"}} onClick={handleSavePrefix}>
                🔒 Áp dụng Prefix mới
              </button>
            </div>
            <div style={{fontSize:11, color:"#94a3b8", marginTop:4}}>
              Định danh hiện tại: <code>{getAppPrefix()}</code>
            </div>
          </div>
        </div>
      </div>

      <div className="card" style={{ borderColor:"#fee2e2" }}>
        <div className="card-header" style={{ background:"#fff5f5" }}><span style={{fontWeight:600, color:"#dc2626"}}>⚠️ Vùng nguy hiểm</span></div>
        <div className="card-body" style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 }}>
          <div>
            <div style={{ fontWeight:500, fontSize:13 }}>Đặt lại kết nối GAS</div>
            <div style={{ fontSize:12, color:"#888" }}>Xóa GAS URL đã lưu — app sẽ quay về màn hình thiết lập lần đầu</div>
          </div>
          <button className="btn btn-danger btn-sm" onClick={() => {
            if (!window.confirm("Xóa GAS URL? App sẽ quay về màn hình thiết lập.")) return;
            removeLS(LS_GAS_URL);
            removeLS(LS_TOKEN);
            location.reload();
          }}>Đặt lại</button>
        </div>
      </div>
    </div>
  );
}
