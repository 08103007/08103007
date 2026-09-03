import React, { useState, useEffect, useMemo } from 'react';
import { 
  isAuthenticated, hasGasUrl, migrateFromLocalStorage, doLoad, _initFromLocalStorage,
  upsertCatalogItems, saveQuotes, exportToJSON, importFromJSON, 
  logout, getLogoUrl, _mem, COMPANY, showToast,
  initLocalFileHandle, getCurrentFileHandle, readFromLocalJsonFile,
  selectAndBindLocalJsonFile, createAndBindLocalJsonFile, hasSupabase
} from './utils/gasStore';
import { preloadAllExportLibs } from './utils/docxBuilder';
import { 
  generateId, generateQuoteNumber, todayStr, fmt, 
  calcItems, getCustomerColor, STATUS_LABELS 
} from './utils/helpers';

// Components & Views
import SetupScreen from './components/SetupScreen';
import LoginScreen from './components/LoginScreen';
import QuoteModal from './components/QuoteModal';
import PrintModal from './components/PrintModal';
import ContractModal from './components/ContractModal';
import HandoverModal from './components/HandoverModal';
import DebtReconciliationModal from './components/DebtReconciliationModal';
import PaymentRequestModal from './components/PaymentRequestModal';

import TasksView from './views/TasksView';
import SettingsView from './views/SettingsView';
import NotesView from './views/NotesView';
import ContractsView from './views/ContractsView';

export default function App() {
  const [quotes, setQuotes] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [authed, setAuthed]       = useState(() => isAuthenticated());
  const [gasReady, setGasReady]   = useState(() => hasGasUrl() || hasSupabase());

  const [view, setView] = useState("list");
  const [showModal, setShowModal] = useState(false);
  const [editQuote, setEditQuote] = useState(null);
  const [printQuote, setPrintQuote] = useState(null);
  const [contractQuote, setContractQuote] = useState(null);
  const [handoverQuote, setHandoverQuote] = useState(null);
  const [showNewHandover, setShowNewHandover] = useState(false);
  const [showDebtRecon, setShowDebtRecon] = useState(false);
  const [showPaymentReq, setShowPaymentReq] = useState(false);
  const [paymentReqData, setPaymentReqData] = useState({});
  const [search, setSearch] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [companyVersion, setCompanyVersion] = useState(0);

  // Lắng nghe GAS Unauthorized event → chuyển về màn đăng nhập ngay
  useEffect(() => {
    const handler = () => setAuthed(false);
    window.addEventListener("gas_unauthorized", handler);
    return () => window.removeEventListener("gas_unauthorized", handler);
  }, []);

  const [fileHandle, setFileHandle] = useState(getCurrentFileHandle());

  // ── Khởi động: Instant load từ PC local file / storage + Sync ngầm với GAS ──────────────────────
  useEffect(() => {
    if (!authed) return;
    
    (async () => {
      // 1. Phôi phục & Đọc từ File JSON trên PC nếu đã liên kết
      try {
        const fh = await initLocalFileHandle();
        if (fh) {
          setFileHandle(fh);
          await readFromLocalJsonFile();
        } else {
          _initFromLocalStorage();
        }
      } catch {
        _initFromLocalStorage();
      }
      setQuotes(_mem.quotes ?? []);
      setLoaded(true);

      // 2. Preload ngầm thư viện xuất file
      preloadAllExportLibs();

      // 3. Đồng bộ dữ liệu mới nhất từ Cloud / Supabase
      try {
        await migrateFromLocalStorage();
        const data = await doLoad((progressQuotes) => {
          if (Array.isArray(progressQuotes) && progressQuotes.length > 0) {
            setQuotes(progressQuotes);
          }
        });
        if (Array.isArray(data) && data.length > 0) {
          setQuotes(data);
        }
        if (_mem.products.length === 0 && data && data.length) {
          await upsertCatalogItems(data.flatMap(q => q.items || []));
        }
      } catch(e) {
        console.error("Background load error:", e);
      }
    })();
  }, [authed]);

  // ── Tự động lưu mỗi khi quotes thay đổi (debounce) ───────────────────────
  useEffect(() => {
    if (!loaded || quotes.length === 0) return;
    saveQuotes(quotes);
  }, [quotes, loaded]);

  const saveQuote = (q) => {
    setQuotes(prev => {
      const idx = prev.findIndex(x => x.id === q.id);
      let updated;
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = q;
      } else {
        updated = [q, ...prev];
      }
      saveQuotes(updated);
      return updated;
    });
    setShowModal(false);
    setEditQuote(null);
  };

  const deleteQuote = (id) => {
    setQuotes(prev => {
      const updated = prev.filter(q => q.id !== id);
      saveQuotes(updated);
      return updated;
    });
    setDeleteConfirm(null);
  };

  const shareQuoteZalo = (q) => {
    const { total } = calcItems(q.items, q.vatRate);
    const text = `📄 BÁO GIÁ PMC - ${COMPANY.short}\n----------------------------\n` +
      `• Số BG: ${q.quoteNumber}\n` +
      `• Khách hàng: ${q.customer}\n` +
      `• Ngày: ${q.date}\n` +
      `• Tổng tiền: ${fmt(total)} VNĐ\n` +
      `----------------------------\n` +
      `Vui lòng xem file PDF đính kèm. Trân trọng!`;
    if (navigator.share) {
      navigator.share({ title: `Báo Giá ${q.quoteNumber}`, text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text);
      showToast("📋 Đã sao chép thông tin báo giá! Bạn có thể dán vào Zalo.", 3000);
    }
  };

  // Filter list: search by quote number, customer, OR item name
  const filtered = useMemo(() => quotes.filter(q => {
    const matchStatus = filterStatus==="all" || q.status===filterStatus;
    if (!matchStatus) return false;
    if (!search && !itemSearch) return true;
    const s = search.toLowerCase().trim();
    const iS = itemSearch.toLowerCase().trim();
    const sNorm = s.replace(/(\d{2})(\d{2})20(\d{2})/, "$1$2$3");
    const matchMain = !s || 
      q.quoteNumber.toLowerCase().includes(s) || 
      q.quoteNumber.toLowerCase().includes(sNorm) || 
      q.customer.toLowerCase().includes(s) ||
      (q.date && q.date.toLowerCase().includes(s));
    const matchItem = !iS || q.items.some(it => it.name.toLowerCase().includes(iS) || (it.note||"").toLowerCase().includes(iS));
    return matchMain && matchItem;
  }).slice().sort((a, b) => {
    const getSortTimestamp = (q) => {
      if (q.createdAt) {
        const t = new Date(q.createdAt).getTime();
        if (!isNaN(t) && t > 0) return t;
      }
      if (q.date && typeof q.date === "string") {
        const parts = q.date.split("/");
        if (parts.length === 3) {
          const day = parts[0].padStart(2, "0");
          const mon = parts[1].padStart(2, "0");
          let yr = parts[2].trim();
          if (yr.length === 2) yr = "20" + yr;
          const t = new Date(`${yr}-${mon}-${day}`).getTime();
          if (!isNaN(t) && t > 0) return t;
        }
      }
      if (q.quoteNumber) {
        const m = q.quoteNumber.replace(/[^0-9]/g, "");
        if (m.length >= 6) {
          const day = m.slice(0, 2);
          const mon = m.slice(2, 4);
          let yr = m.slice(4, 6);
          if (m.length >= 8 && m.slice(4, 8).startsWith("20")) yr = m.slice(4, 8);
          else yr = "20" + yr;
          const t = new Date(`${yr}-${mon}-${day}`).getTime();
          if (!isNaN(t) && t > 0) return t;
        }
      }
      return 0;
    };
    const tA = getSortTimestamp(a);
    const tB = getSortTimestamp(b);
    if (tA !== tB) return tB - tA;
    return (b.quoteNumber || "").localeCompare(a.quoteNumber || "");
  }), [quotes, filterStatus, search, itemSearch]);

  const statusCounts = useMemo(() => {
    const counts = {};
    Object.keys(STATUS_LABELS).forEach(k => { counts[k] = 0; });
    quotes.forEach(q => { if (counts[q.status] !== undefined) counts[q.status]++; });
    return counts;
  }, [quotes]);

  const stats = useMemo(() => ({
    total: quotes.length,
    draft: statusCounts.draft || 0,
    sent: statusCounts.sent || 0,
    accepted: statusCounts.accepted || 0,
    totalValue: quotes.reduce((s,q)=>s+calcItems(q.items,q.vatRate).total,0),
    acceptedValue: quotes.filter(q=>q.status==="accepted").reduce((s,q)=>s+calcItems(q.items,q.vatRate).total,0),
  }), [quotes, statusCounts]);

  if (!gasReady) {
    return <SetupScreen onDone={() => setGasReady(true)} />;
  }

  if (!authed) {
    return <LoginScreen onLogin={() => setAuthed(true)} />;
  }

  if (!loaded) {
    return (
      <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"var(--bg-app)", flexDirection:"column", gap:12 }}>
        {getLogoUrl() ? <img src={getLogoUrl()} style={{ width:56, objectFit:"contain" }} alt="PMC" /> : null}
        <div style={{ color:"var(--text-muted)", fontSize:13, fontWeight:500 }}>Đang tải dữ liệu...</div>
      </div>
    );
  }

  if (view === "debt_recon") {
    return (
      <DebtReconciliationModal 
        onClose={() => setView("list")} 
        onOpenPaymentRequest={(initialData) => {
          setPaymentReqData(initialData);
          setView("payment_req");
        }}
      />
    );
  }

  if (view === "payment_req") {
    return (
      <PaymentRequestModal
        initialData={paymentReqData || {}}
        onClose={() => setView("list")}
      />
    );
  }

  return (
    <div className="app">
      <div className="topbar no-print">
        <div className="topbar-brand">
          {getLogoUrl() ? <img src={getLogoUrl()} alt="PMC" /> : null}
          <span>Quản Lý Báo Giá – {COMPANY.short}</span>
        </div>
        <div className="topbar-actions">
          <button
            className="btn btn-ghost"
            title="Đăng xuất"
            onClick={logout}
          >
            🔒 Đăng xuất
          </button>
          <button className="btn btn-primary topbar-create" onClick={()=>{setEditQuote(null);setShowModal(true);}}>
            + Tạo báo giá
          </button>
        </div>
      </div>



      <div className="main">
        <div className="sidebar no-print">
          <div className="sidebar-section">Menu</div>
          <div className={`sidebar-item ${view==="dashboard"?"active":""}`} onClick={()=>setView("dashboard")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            <span className="sidebar-label">Dashboard</span>
          </div>
          <div className={`sidebar-item ${view==="list"?"active":""}`} onClick={()=>setView("list")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2"/></svg>
            <span className="sidebar-label">Báo giá</span>
            <span className="sidebar-badge">{quotes.length}</span>
          </div>
          <div className={`sidebar-item ${view==="handover"?"active":""}`} onClick={()=>setView("handover")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 12l2 2 4-4"/><path d="M21 12c0 4.97-4.03 9-9 9S3 16.97 3 12 7.03 3 12 3s9 4.03 9 9z"/></svg>
            <span className="sidebar-label">Biên bản & Giao hàng</span>
          </div>
          <div className={`sidebar-item ${view==="contracts"?"active":""}`} onClick={()=>setView("contracts")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            <span className="sidebar-label">Hợp đồng</span>
            <span className="sidebar-badge">{Object.keys(_mem.contracts||{}).length}</span>
          </div>
          <div className={`sidebar-item ${view==="debt_recon"?"active":""}`} onClick={()=>setView("debt_recon")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 7H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-3"/><path d="M9 7V4a2 2 0 0 1 2-2h5l4 4v5a2 2 0 0 1-2 2h-3"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/></svg>
            <span className="sidebar-label">Đối chiếu CN</span>
          </div>
          <div className={`sidebar-item ${view==="payment_req"?"active":""}`} onClick={()=>{ setPaymentReqData({}); setView("payment_req"); }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
            <span className="sidebar-label">Đề nghị TT</span>
          </div>
          <div className={`sidebar-item ${view==="tasks"?"active":""}`} onClick={()=>setView("tasks")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/></svg>
            <span className="sidebar-label">Công việc</span>
          </div>
          <div className={`sidebar-item ${view==="notes"?"active":""}`} onClick={()=>setView("notes")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            <span className="sidebar-label">Ghi chú</span>
          </div>

          <div className={`sidebar-item ${view==="settings"?"active":""}`} onClick={()=>setView("settings")}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            <span className="sidebar-label">Cài đặt</span>
          </div>


          <div className="sidebar-section">Trạng thái</div>
          {Object.entries(STATUS_LABELS).map(([k,v])=>(
            <div key={k} className={`sidebar-item ${filterStatus===k&&view==="list"?"active":""}`}
              onClick={()=>{setFilterStatus(k);setView("list");}}>
              <span style={{width:8,height:8,borderRadius:"50%",background:{draft:"#9ca3af",sent:"#3b82f6",accepted:"#22c55e",rejected:"#ef4444"}[k],display:"inline-block"}}/>
              {v}
              <span style={{marginLeft:"auto",fontSize:11,color:"#aaa"}}>{statusCounts[k] || 0}</span>
            </div>
          ))}
          <div className={`sidebar-item ${filterStatus==="all"&&view==="list"?"active":""}`}
            onClick={()=>{setFilterStatus("all");setView("list");}}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/></svg>
            Tất cả
          </div>
        </div>

        <div className="content">
          {view === "dashboard" && (
            <div>
              <div style={{marginBottom:20}}>
                <h2 style={{fontSize:18,fontWeight:700,fontFamily:"var(--font-display)",letterSpacing:"-0.02em",color:"var(--primary)",marginBottom:4}}>Dashboard</h2>
                <p style={{color:"var(--text-muted)",fontSize:13}}>Tổng quan hoạt động báo giá</p>
              </div>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-label">Tổng báo giá</div>
                  <div className="stat-value">{stats.total}</div>
                  <div className="stat-sub">Tất cả trạng thái</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Chờ phản hồi</div>
                  <div className="stat-value" style={{color:"var(--accent)"}}>{stats.sent}</div>
                  <div className="stat-sub">Đã gửi khách</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Chấp nhận</div>
                  <div className="stat-value" style={{color:"var(--success)"}}>{stats.accepted}</div>
                  <div className="stat-sub">Đơn thành công</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Doanh số chấp nhận</div>
                  <div className="stat-value">{fmt(stats.acceptedValue)}đ</div>
                  <div className="stat-sub">Có VAT</div>
                </div>
              </div>
              <div className="card">
                <div className="card-header">
                  <span style={{fontWeight:600,fontFamily:"var(--font-display)",color:"var(--primary)"}}>Báo giá gần đây</span>
                  <button className="btn btn-ghost btn-sm" onClick={()=>setView("list")}>Xem tất cả →</button>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Số BG</th><th>Khách hàng</th><th>Ngày</th><th>Tổng tiền</th><th>Trạng thái</th></tr></thead>
                    <tbody>
                      {quotes.slice(0,5).map(q=>{
                        const {total}=calcItems(q.items,q.vatRate);
                        return (
                          <tr key={q.id} style={{cursor:"pointer"}} onClick={()=>{setEditQuote(q);setShowModal(true);}}>
                            <td style={{fontWeight:600,color:"var(--primary)"}}>{q.quoteNumber}</td>
                            <td>
                              {(() => {
                                const col = getCustomerColor(q.customer);
                                return (
                                  <span style={{background:col.bg,color:col.text,borderRadius:6,padding:"3px 9px",fontSize:12.5,fontWeight:600}}>
                                    {q.customer}
                                  </span>
                                );
                              })()}
                            </td>
                            <td style={{color:"var(--text-muted)"}}>{q.date}</td>
                            <td style={{fontWeight:600,color:"var(--primary)"}}>{fmt(total)} đ</td>
                            <td><span className={`badge badge-${q.status}`}>{STATUS_LABELS[q.status]}</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {view === "tasks" && (
            <TasksView quotes={quotes} />
          )}

          {view === "settings" && (
            <SettingsView 
              onCompanyUpdate={(co) => {
                Object.assign(COMPANY, co);
                setCompanyVersion(v => v + 1);
              }}
              onQuotesImport={(newQuotes) => setQuotes(newQuotes)}
            />
          )}

          {view === "notes" && (
            <NotesView />
          )}

          {view === "contracts" && (
            <ContractsView quotes={quotes} onOpenContract={(q) => setContractQuote(q)} />
          )}

          {view === "handover" && (
            <div>
              <div style={{marginBottom:20,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <div>
                  <h2 style={{fontSize:18,fontWeight:700,fontFamily:"var(--font-display)",letterSpacing:"-0.02em",color:"var(--primary)",marginBottom:4}}>Biên bản bàn giao & nghiệm thu (kèm Phiếu giao hàng)</h2>
                  <p style={{color:"var(--text-muted)",fontSize:13}}>Tạo biên bản nghiệm thu và bàn giao kèm phiếu giao hàng từ báo giá hoặc tạo mới độc lập</p>
                </div>
                <button className="btn btn-primary" onClick={()=>setShowNewHandover(true)}>+ Tạo BBBG & Phiếu giao hàng mới</button>
              </div>
              <div className="card">
                <div style={{padding:"16px 20px",borderBottom:"1px solid var(--border-color)"}}>
                  <div style={{fontSize:13,color:"var(--text-muted)",fontWeight:600}}>Tạo từ báo giá có sẵn</div>
                  <div style={{fontSize:12,color:"var(--text-light)",marginTop:3}}>Chọn một báo giá bên dưới để tạo Biên bản nghiệm thu & bàn giao kèm Phiếu giao hàng từ danh sách hàng hóa</div>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Số BG</th>
                        <th>Khách hàng</th>
                        <th>Ngày</th>
                        <th style={{textAlign:"center"}}>Hàng hóa</th>
                        <th style={{textAlign:"right"}}>Tổng tiền</th>
                        <th style={{textAlign:"center"}}>Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {quotes.map(q=>{
                        const {total}=calcItems(q.items,q.vatRate);
                        return (
                          <tr key={q.id}>
                            <td style={{fontWeight:600,color:"var(--primary)"}}>
                              {q.quoteNumber}
                              {q.isJointVenture && (
                                <span 
                                  title={`Liên doanh với ${q.partnerName || "đối tác"}`} 
                                  style={{marginLeft:6, fontSize:9, background:"var(--danger-bg)", color:"var(--danger-text)", padding:"1.5px 5px", borderRadius:4, fontWeight:600, display:"inline-flex", alignItems:"center", verticalAlign:"middle"}}
                                >
                                  🤝 Liên doanh
                                </span>
                              )}
                            </td>
                            <td>{q.customer}</td>
                            <td style={{color:"var(--text-muted)",whiteSpace:"nowrap"}}>{q.date}</td>
                            <td style={{textAlign:"center",color:"var(--text-muted)"}}>{q.items.length} dòng</td>
                            <td style={{textAlign:"right",fontWeight:600,color:"var(--primary)"}}>{fmt(total)} đ</td>
                            <td>
                              <div style={{display:"flex",gap:4,justifyContent:"center"}}>
                                <button className="btn btn-primary btn-sm" onClick={()=>setHandoverQuote(q)}>
                                  📋 Tạo BBBG & Phiếu GH
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {view === "list" && (
            <div>
              <div style={{marginBottom:20}}>
                <h2 style={{fontSize:18,fontWeight:700,fontFamily:"var(--font-display)",letterSpacing:"-0.02em",color:"var(--primary)",marginBottom:4}}>Danh sách báo giá</h2>
                <p style={{color:"var(--text-muted)",fontSize:13}}>{filtered.length} báo giá {filterStatus!=="all"?`– ${STATUS_LABELS[filterStatus]}`:""}</p>
              </div>
              <div className="filter-bar">
                <input className="search-input" placeholder="🔍 Tìm số BG hoặc khách hàng..." value={search} onChange={e=>setSearch(e.target.value)} />
                <input className="search-input" style={{width:240}} placeholder="📦 Tìm tên hàng hóa..." value={itemSearch} onChange={e=>setItemSearch(e.target.value)} />
                <select className="form-control" style={{width:"auto"}} value={filterStatus} onChange={e=>setFilterStatus(e.target.value)}>
                  <option value="all">Tất cả trạng thái</option>
                  {Object.entries(STATUS_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                </select>
                <button className="btn btn-primary" onClick={()=>{setEditQuote(null);setShowModal(true);}}>+ Tạo báo giá</button>
              </div>
              <div className="card">
                {filtered.length===0?(
                  <div className="empty-state">
                    <div style={{fontSize:40}}>📄</div>
                    <h3>Không tìm thấy báo giá</h3>
                    <p style={{fontSize:13}}>{search||itemSearch ? "Thử thay đổi từ khóa tìm kiếm" : "Tạo báo giá mới để bắt đầu"}</p>
                    {!search&&!itemSearch&&<button className="btn btn-primary" style={{marginTop:12}} onClick={()=>{setEditQuote(null);setShowModal(true);}}>+ Tạo báo giá đầu tiên</button>}
                  </div>
                ):(
                  <>
                    {/* Desktop Table View */}
                    <div className="table-wrap desktop-only">
                      <table>
                        <thead>
                          <tr>
                            <th>Số BG</th>
                            <th>Khách hàng</th>
                            <th>Ngày</th>
                            <th>Hàng hóa</th>
                            <th style={{textAlign:"right"}}>Tổng tiền</th>
                            <th>Trạng thái</th>
                            <th style={{textAlign:"center"}}>Thao tác</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map(q=>{
                            const {total}=calcItems(q.items,q.vatRate);
                            const matchedItems = itemSearch ? q.items.filter(it => it.name.toLowerCase().includes(itemSearch.toLowerCase())) : [];
                            return (
                              <tr key={q.id}>
                                <td style={{fontWeight:600,color:"var(--primary)"}}>
                                  {q.quoteNumber}
                                  {q.versions && q.versions.length > 0 && (
                                    <span
                                      title={`Lịch sử ${q.versions.length} phiên bản`}
                                      style={{ marginLeft: 6, fontSize: 10, background: "#f1f5f9", color: "#475569", border: "1px solid #cbd5e1", padding: "1.5px 6px", borderRadius: 4, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 2, verticalAlign: "middle" }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditQuote(q);
                                        setShowModal(true);
                                      }}
                                    >
                                      📜 v{q.versions.length + 1}
                                    </span>
                                  )}
                                  {q.internalNote && <span title={q.internalNote} style={{marginLeft:5,fontSize:11,cursor:"help"}}>🔒</span>}
                                  {q.isJointVenture && (
                                    <span 
                                      title={`Liên doanh với ${q.partnerName || "đối tác"}`} 
                                      style={{marginLeft:6, fontSize:10, background:"var(--danger-bg)", color:"var(--danger-text)", padding:"1.5px 6px", borderRadius:4, fontWeight:600, display:"inline-flex", alignItems:"center", gap:2, verticalAlign:"middle"}}
                                    >
                                      🤝 Liên doanh
                                    </span>
                                  )}
                                </td>
                                <td>
                                  {(() => {
                                    const col = getCustomerColor(q.customer);
                                    const itemNames = (q.items || []).map(i => i.name).filter(Boolean);
                                    const itemSummary = itemNames.slice(0, 3).join(", ");
                                    const hasMore = itemNames.length > 3;
                                    const summaryText = itemSummary ? `📦 ${itemSummary}${hasMore ? '...' : ''}` : '';

                                    return (
                                      <div 
                                        style={{ cursor: "pointer" }} 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setPrintQuote(q);
                                        }}
                                        title="Click vào tên công ty để xem báo giá"
                                      >
                                        <div style={{
                                          display: "inline-block",
                                          background: col.bg,
                                          color: col.text,
                                          borderRadius: 6,
                                          padding: "3px 9px",
                                          fontSize: 12.5,
                                          fontWeight: 600,
                                          marginBottom: 3
                                        }}>
                                          {q.customer}
                                        </div>
                                        {q.contact && (
                                          <div style={{ fontSize: 11, color: "var(--text-light)", marginBottom: 2 }}>
                                            👤 {q.contact}
                                          </div>
                                        )}
                                        {summaryText && (
                                          <div style={{
                                            fontSize: 10.5,
                                            color: "#475569",
                                            background: "#f1f5f9",
                                            padding: "2px 7px",
                                            borderRadius: 4,
                                            marginTop: 2,
                                            display: "inline-block",
                                            maxWidth: "320px",
                                            whiteSpace: "nowrap",
                                            overflow: "hidden",
                                            textOverflow: "ellipsis",
                                            border: "1px solid #cbd5e1"
                                          }}>
                                            {summaryText}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })()}
                                </td>
                                <td style={{color:"var(--text-muted)",whiteSpace:"nowrap"}}>{q.date}</td>
                                <td style={{textAlign:"center",color:"var(--text-muted)"}}>{q.items.length} dòng</td>
                                <td style={{textAlign:"right",fontWeight:600,color:"var(--primary)"}}>{fmt(total)} đ</td>
                                <td>
                                  <select className="badge" style={{border:"1px solid var(--border-color)",background:"none",cursor:"pointer",fontSize:11,padding:"3px 6px",borderRadius:4}}
                                    value={q.status}
                                    onChange={e=>{
                                      const val = e.target.value;
                                      setQuotes(prev => {
                                        const updated = prev.map(x => x.id === q.id ? { ...x, status: val } : x);
                                        saveQuotes(updated);
                                        return updated;
                                      });
                                    }}>
                                    {Object.entries(STATUS_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
                                  </select>
                                </td>
                                <td>
                                  <div style={{display:"flex",gap:4,justifyContent:"center"}}>
                                    <button className="btn btn-ghost btn-sm btn-icon" title="Xem & In / Xuất" onClick={()=>setPrintQuote(q)}>🖨️</button>
                                    <button className="btn btn-ghost btn-sm btn-icon" title="Chỉnh sửa" onClick={()=>{setEditQuote(q);setShowModal(true);}}>✏️</button>
                                    <button className="btn btn-ghost btn-sm btn-icon" title="Nhân bản" onClick={()=>{
                                      const copy={...JSON.parse(JSON.stringify(q)),id:generateId(),quoteNumber:generateQuoteNumber([...quotes,q]),date:todayStr(),status:"draft"};
                                      setQuotes(prev => {
                                        const updated = [copy, ...prev];
                                        saveQuotes(updated);
                                        return updated;
                                      });
                                    }}>⧉</button>
                                    <button
                                      className="btn btn-ghost btn-sm btn-icon"
                                      title="Xóa (giữ Shift + click)"
                                      style={{color:"var(--danger)",opacity:0.6,transition:"opacity 0.15s"}}
                                      onMouseEnter={e=>e.currentTarget.style.opacity="1"}
                                      onMouseLeave={e=>e.currentTarget.style.opacity="0.5"}
                                      onClick={(e)=>{
                                        if (!e.shiftKey) {
                                          showToast("⚠️ Giữ phím Shift rồi click để xóa", 2000);
                                          return;
                                        }
                                        setDeleteConfirm(q.id);
                                      }}
                                    >🗑️</button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile High-Touch View & PDF Card Stream */}
                    <div className="mobile-card-list mobile-only" style={{padding:12}}>
                      {filtered.map(q => {
                        const { total } = calcItems(q.items, q.vatRate);
                        const col = getCustomerColor(q.customer);
                        const itemNames = (q.items || []).map(i => i.name).filter(Boolean);
                        const itemSummary = itemNames.slice(0, 3).join(", ");
                        const hasMore = itemNames.length > 3;

                        return (
                          <div key={q.id} className="mobile-quote-card" onClick={() => setPrintQuote(q)}>
                            <div className="mobile-card-header">
                              <span className="mobile-quote-num">{q.quoteNumber}</span>
                              <span className={`badge badge-${q.status}`}>{STATUS_LABELS[q.status]}</span>
                            </div>
                            <div className="mobile-card-customer">
                              <div>
                                <span className="cust-pill" style={{ background: col.bg, color: col.text }}>{q.customer}</span>
                                {itemSummary && (
                                  <div style={{ fontSize: 10.5, color: "#475569", marginTop: 4 }}>
                                    📦 {itemSummary}{hasMore ? '...' : ''}
                                  </div>
                                )}
                              </div>
                              <span className="mobile-card-date">📅 {q.date}</span>
                            </div>
                            <div className="mobile-card-body">
                              <span className="mobile-item-count">📦 {q.items.length} mặt hàng</span>
                              <span className="mobile-total-val">{fmt(total)} đ</span>
                            </div>
                            <div className="mobile-card-actions" onClick={e => e.stopPropagation()}>
                              <button className="btn btn-primary btn-sm mobile-act-btn" onClick={() => setPrintQuote(q)}>
                                🖨️ Xuất PDF / In
                              </button>
                              <button className="btn btn-ghost btn-sm mobile-act-btn" onClick={() => shareQuoteZalo(q)}>
                                📲 Zalo
                              </button>
                              <button className="btn btn-ghost btn-sm mobile-act-btn" onClick={() => { setEditQuote(q); setShowModal(true); }}>
                                ✏️ Sửa
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Mobile Bottom Navigation Dock */}
      <div className="mobile-bottom-dock no-print">
        <button className={`dock-item ${view==="list"?"active":""}`} onClick={()=>setView("list")}>
          <span className="dock-icon">📋</span>
          <span className="dock-label">Báo Giá</span>
        </button>
        <button className={`dock-item ${view==="contracts"?"active":""}`} onClick={()=>setView("contracts")}>
          <span className="dock-icon">📄</span>
          <span className="dock-label">Hợp Đồng</span>
        </button>
        <button className={`dock-item ${view==="handover"?"active":""}`} onClick={()=>setView("handover")}>
          <span className="dock-icon">🚚</span>
          <span className="dock-label">Biên Bản & GH</span>
        </button>
        <button className={`dock-item ${view==="debt_recon"?"active":""}`} onClick={()=>setView("debt_recon")}>
          <span className="dock-icon">📊</span>
          <span className="dock-label">Công Nợ</span>
        </button>
        <button className={`dock-item ${view==="settings"?"active":""}`} onClick={()=>setView("settings")}>
          <span className="dock-icon">⚙️</span>
          <span className="dock-label">Cài Đặt</span>
        </button>
      </div>

      <button className="fab-btn no-print" onClick={()=>{setEditQuote(null);setShowModal(true);}} title="Tạo báo giá mới">＋</button>

      {showModal && (
        <QuoteModal
          quote={editQuote}
          allQuotes={quotes}
          onSave={saveQuote}
          onClose={()=>{setShowModal(false);setEditQuote(null);}}
        />
      )}

      {printQuote && (
        <PrintModal
          quote={printQuote}
          onClose={()=>setPrintQuote(null)}
          onCreateContract={(q)=>{setPrintQuote(null);setContractQuote(q);}}
          onHandover={(q)=>{setPrintQuote(null);setHandoverQuote(q);}}
        />
      )}

      {contractQuote && (
        <ContractModal
          quote={contractQuote}
          onClose={()=>setContractQuote(null)}
        />
      )}

      {handoverQuote && (
        <HandoverModal
          quote={handoverQuote}
          onClose={()=>setHandoverQuote(null)}
        />
      )}

      {showNewHandover && (
        <HandoverModal
          quote={null}
          onClose={()=>setShowNewHandover(false)}
        />
      )}

      {deleteConfirm && (
        <div className="modal-overlay" onClick={()=>setDeleteConfirm(null)}>
          <div className="modal" style={{maxWidth:380}} onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">🗑️ Xác nhận xóa</span>
              <button className="close-btn" onClick={()=>setDeleteConfirm(null)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{fontSize:14,color:"#555",lineHeight:1.7}}>Bạn đang xóa báo giá <b>{quotes.find(q=>q.id===deleteConfirm)?.quoteNumber}</b>.<br/>Hành động này <b style={{color:"#dc2626"}}>không thể hoàn tác</b>.</p>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={()=>setDeleteConfirm(null)}>Hủy</button>
              <button className="btn btn-danger" onClick={()=>deleteQuote(deleteConfirm)}>Xóa vĩnh viễn</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
