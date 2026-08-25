import React, { useState, useEffect } from 'react';
import { loadDelivery, saveDelivery, COMPANY, getLogoUrl, showToast } from '../utils/gasStore';
import { generateId } from '../utils/helpers';
import { printElementViaIframe, exportElementToPdf } from '../utils/pdfExporter';

const DELIVERY_T = {
  vi: {
    title: "PHIẾU GIAO HÀNG",
    ref: "Số",
    partyA: "BÊN GIAO HÀNG",
    partyB: "BÊN NHẬN HÀNG",
    company: "Công ty:",
    deliverer: "Người giao:",
    receiver: "Người nhận:",
    phone: "Điện thoại:",
    unit: "Đơn vị:",
    address: "Địa chỉ giao hàng:",
    colStt: "STT",
    colItem: "TÊN HÀNG HÓA / DỊCH VỤ",
    colQty: "SỐ LƯỢNG",
    colUnit: "ĐVT",
    colSerial: "SERIAL / SN",
    noteLabel: "Ghi chú:",
    confirmText: "Hai bên xác nhận hàng hóa giao nhận đúng số lượng, chủng loại và tình trạng như trên. Phiếu giao hàng được lập thành 02 bản, mỗi bên giữ 01 bản có giá trị như nhau.",
    signDeliverer: "NGƯỜI GIAO HÀNG",
    signReceiver: "NGƯỜI NHẬN HÀNG",
    signSub: "(Ký và ghi rõ họ tên)"
  },
  vi_en: {
    title: "PHIẾU GIAO HÀNG",
    titleB: "DELIVERY NOTE",
    ref: "Số / No",
    partyA: "BÊN GIAO HÀNG (DELIVERER)",
    partyB: "BÊN NHẬN HÀNG (RECEIVER)",
    company: "Công ty (Company):",
    deliverer: "Người giao (Deliverer):",
    receiver: "Người nhận (Receiver):",
    phone: "Điện thoại (Tel):",
    unit: "Đơn vị (Company):",
    address: "Địa chỉ giao hàng (Delivery Address):",
    colStt: "STT / NO.",
    colItem: "TÊN HÀNG HÓA / DỊCH VỤ (DESCRIPTION)",
    colQty: "SỐ LƯỢNG (QTY)",
    colUnit: "ĐVT (UNIT)",
    colSerial: "SERIAL / SN",
    noteLabel: "Ghi chú (Notes):",
    confirmText: "Hai bên xác nhận hàng hóa giao nhận đúng số lượng, chủng loại và tình trạng như trên. Phiếu giao hàng được lập thành 02 bản, mỗi bên giữ 01 bản có giá trị như nhau.\nBoth parties confirm that goods delivered and received are in correct quantity, specification and condition as above. Delivery Note is made in 02 copies, each party keeping 01 copy of equal validity.",
    signDeliverer: "NGƯỜI GIAO HÀNG (DELIVERER)",
    signReceiver: "NGƯỜI NHẬN HÀNG (RECEIVER)",
    signSub: "(Ký, ghi rõ họ tên / Sign & Full Name)"
  },
  vi_zh: {
    title: "PHIẾU GIAO HÀNG",
    titleB: "送货单",
    ref: "Số / 编号",
    partyA: "BÊN GIAO HÀNG (送货方)",
    partyB: "BÊN NHẬN HÀNG (收货方)",
    company: "Công ty (公司):",
    deliverer: "Người giao (送货人):",
    receiver: "Người nhận (收货人):",
    phone: "Điện thoại (电话):",
    unit: "Đơn vị (单位):",
    address: "Địa chỉ giao hàng (送货地址):",
    colStt: "STT / 序号",
    colItem: "TÊN HÀNG HÓA / DỊCH VỤ (货物/服务)",
    colQty: "SỐ LƯỢNG (数量)",
    colUnit: "ĐVT (单位)",
    colSerial: "SERIAL / SN",
    noteLabel: "Ghi chú (备注):",
    confirmText: "Hai bên xác nhận hàng hóa giao nhận đúng số lượng, chủng loại và tình trạng như trên. Phiếu giao hàng được lập thành 02 bản, mỗi bên giữ 01 bản có giá trị như nhau.\n双方确认收发货物数量、种类及状况均与上述相符。送货单制作02份，每方各执01份，具有同等效力。",
    signDeliverer: "NGƯỜI GIAO HÀNG (送货方)",
    signReceiver: "NGƯỜI NHẬN HÀNG (收货方)",
    signSub: "(Ký, ghi rõ họ tên / 签名及全名)"
  }
};

export default function DeliveryModal({ quote, onClose }) {
  const today = new Date();
  const todayFull = `ngày ${String(today.getDate()).padStart(2,"0")} tháng ${String(today.getMonth()+1).padStart(2,"0")} năm ${today.getFullYear()}`;

  const [lang, setLang] = useState("vi"); // "vi" | "vi_en" | "vi_zh"
  const [translating, setTranslating] = useState(false);

  const [refNum,        setRefNum]        = useState(() => "PGH-" + (quote?.quoteNumber || generateId().slice(0,6).toUpperCase()));
  const [dateStr,       setDateStr]       = useState(todayFull);
  const [delivererName, setDelivererName] = useState("Trần Văn Thịnh");
  const [delivererPhone,setDelivererPhone]= useState(COMPANY.phone || "");
  const [receiverName,  setReceiverName]  = useState("");
  const [receiverPhone, setReceiverPhone] = useState(quote?.phone || "");
  const [receiverCompany,setReceiverCompany]=useState(quote?.customer || "");
  const [deliveryAddress,setDeliveryAddress]=useState(quote?.address || "");
  const [note,          setNote]          = useState("");
  const [noteEn,        setNoteEn]        = useState("");
  const [pdfLoading,    setPdfLoading]    = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [saveMsg,       setSaveMsg]       = useState("");

  const storageId = quote ? ("dv_" + quote.id) : null;

  const [items, setItems] = useState(() => {
    if (!quote) return [{ id: generateId(), name: "", nameEn: "", qty: 1, unit: "Cái", serial: "" }];
    return quote.items.map(it => ({ id: it.id, name: it.name, nameEn: "", qty: it.qty, unit: it.unit, serial: "" }));
  });

  const addItem    = () => setItems(p => [...p, { id: generateId(), name: "", nameEn: "", qty: 1, unit: "Cái", serial: "" }]);
  const removeItem = id  => setItems(p => p.filter(it => it.id !== id));
  const setField   = (id, f, v) => setItems(p => p.map(it => it.id === id ? { ...it, [f]: v } : it));

  useEffect(() => {
    if (!storageId) return;
    loadDelivery(storageId).then(saved => {
      if (!saved) return;
      if (saved.lang)            setLang(saved.lang);
      if (saved.refNum)          setRefNum(saved.refNum);
      if (saved.dateStr)         setDateStr(saved.dateStr);
      if (saved.delivererName)   setDelivererName(saved.delivererName);
      if (saved.delivererPhone)  setDelivererPhone(saved.delivererPhone);
      if (saved.receiverName)    setReceiverName(saved.receiverName);
      if (saved.note)            setNote(saved.note);
      if (saved.noteEn)          setNoteEn(saved.noteEn);

      if (quote) {
        setReceiverCompany(quote.customer);
        setDeliveryAddress(quote.address || "");
        setReceiverPhone(quote.phone || "");
        const merged = quote.items.map(it => {
          const savedIt = saved.items?.find(s => s.id === it.id || s.name === it.name);
          return {
            id: it.id,
            name: it.name,
            nameEn: savedIt?.nameEn || "",
            qty: it.qty,
            unit: it.unit,
            serial: savedIt?.serial || ""
          };
        });
        const customItems = saved.items?.filter(s => !quote.items.some(it => it.id === s.id || it.name === s.name)) || [];
        setItems([...merged, ...customItems]);
      } else {
        if (saved.receiverCompany) setReceiverCompany(saved.receiverCompany);
        if (saved.deliveryAddress) setDeliveryAddress(saved.deliveryAddress);
        if (saved.receiverPhone)   setReceiverPhone(saved.receiverPhone);
        if (saved.items && saved.items.length) setItems(saved.items);
      }
    }).catch(() => {});
  }, [storageId, quote]);

  const handleSave = async () => {
    if (!storageId) { showToast("⚠️ Cần gắn phiếu vào một báo giá để lưu", 2500); return; }
    setSaving(true);
    try {
      await saveDelivery(storageId, { lang, refNum, dateStr, delivererName, delivererPhone, receiverName, receiverPhone, receiverCompany, deliveryAddress, note, noteEn, items });
      setSaveMsg("✓ Đã lưu");
      setTimeout(() => setSaveMsg(""), 2000);
    } finally { setSaving(false); }
  };

  const handleAutoTranslate = async () => {
    if (lang === "vi") {
      showToast("💡 Vui lòng chọn ngôn ngữ Song ngữ (Việt - Anh hoặc Việt - Trung)", 2500);
      return;
    }
    setTranslating(true);
    const targetLangCode = lang === "vi_en" ? "en" : "zh-CN";

    const translateStr = async (str) => {
      if (!str || !str.trim()) return "";
      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=vi&tl=${targetLangCode}&dt=t&q=${encodeURIComponent(str.trim())}`;
        const res = await fetch(url);
        const data = await res.json();
        return data?.[0]?.map(x => x[0]).join("") || str;
      } catch (e) {
        return str;
      }
    };

    try {
      if (note) {
        const transNote = await translateStr(note);
        setNoteEn(transNote);
      }

      const updatedItems = await Promise.all(items.map(async it => {
        if (it.name) {
          const transName = await translateStr(it.name);
          return { ...it, nameEn: transName };
        }
        return it;
      }));
      setItems(updatedItems);
      showToast("✓ Tự động dịch phiếu giao hàng thành công!", 2000);
    } catch(e) {
      showToast("⚠️ Lỗi tự động dịch: " + e.message, 2500);
    } finally {
      setTranslating(false);
    }
  };

  const handlePrint = () => {
    printElementViaIframe("deliveryPreviewContent", `
      #deliveryPreviewContent * { color:#000 !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; font-family:'Plus Jakarta Sans',sans-serif !important; }
      .handover-items-table { width:100% !important; table-layout:fixed !important; border:1px solid #000 !important; border-collapse:collapse !important; margin:12px 0 !important; }
      .handover-items-table th, .handover-items-table td { border-right:1px solid #000 !important; border-bottom:1px solid #000 !important; padding:5px 7px !important; }
      .handover-items-table th { white-space:normal !important; word-break:break-word !important; overflow-wrap:break-word !important; vertical-align:middle !important; line-height:1.25 !important; }
      .handover-items-table th:nth-child(1), .handover-items-table td:nth-child(1) { width:8% !important; text-align:center !important; }
      .handover-items-table td:nth-child(1) { white-space:nowrap !important; }
      .handover-items-table th:nth-child(2), .handover-items-table td:nth-child(2) { width:44% !important; word-break:break-word !important; overflow-wrap:break-word !important; word-wrap:break-word !important; text-align:left !important; }
      .handover-items-table th:nth-child(3), .handover-items-table td:nth-child(3) { width:15% !important; text-align:center !important; }
      .handover-items-table td:nth-child(3) { white-space:nowrap !important; }
      .handover-items-table th:nth-child(4), .handover-items-table td:nth-child(4) { width:11% !important; text-align:center !important; }
      .handover-items-table td:nth-child(4) { white-space:nowrap !important; }
      .handover-items-table th:nth-child(5), .handover-items-table td:nth-child(5) { width:22% !important; word-break:break-word !important; overflow-wrap:break-word !important; text-align:center !important; }
      .handover-items-table th:last-child, .handover-items-table td:last-child { border-right:none !important; }
      .handover-items-table tr:last-child td { border-bottom:none !important; }
    `);
  };

  const handlePDF = async () => {
    await exportElementToPdf("deliveryPreviewContent", {
      filename: "PhieuGiaoHang_" + refNum + ".pdf",
      pad: 36,
    });
  };

  const handlePDFClick = async () => { setPdfLoading(true); try { await handlePDF(); } finally { setPdfLoading(false); } };

  const T = DELIVERY_T[lang] || DELIVERY_T.vi;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 1020 }}>
        <div className="modal-header no-print">
          <span className="modal-title">🚚 Phiếu giao hàng</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button 
              className="btn btn-ghost btn-sm" 
              onClick={handleAutoTranslate} 
              disabled={translating || lang === "vi"} 
              title="Tự động dịch nội dung sang tiếng Anh/Trung"
            >
              {translating ? "⏳ Đang dịch..." : `🌐 Tự động dịch → ${lang === "vi_zh" ? "中文" : "EN"}`}
            </button>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="modal-body" style={{ display: "flex", gap: 20 }}>
          {/* Left: Form */}
          <div className="no-print hw-form-col" style={{ width: 320, flexShrink: 0, borderRight: "1px solid #e5e3dc", paddingRight: 20, overflowY: "auto" }}>
            <div className="hw-form-section">
              <h4>Ngôn ngữ hiển thị</h4>
              <div className="form-group">
                <select className="form-control" value={lang} onChange={e => setLang(e.target.value)}>
                  <option value="vi">🇻🇳 Chỉ Tiếng Việt (Mặc định)</option>
                  <option value="vi_en">🇻🇳 🇬🇧 Song ngữ Việt - Anh</option>
                  <option value="vi_zh">🇻🇳 🇨🇳 Song ngữ Việt - Trung</option>
                </select>
              </div>
            </div>

            <div className="hw-form-section">
              <h4>Thông tin phiếu</h4>
              <div className="form-group">
                <label>Số phiếu</label>
                <input className="form-control" value={refNum} onChange={e => setRefNum(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Ngày lập</label>
                <input className="form-control" value={dateStr} onChange={e => setDateStr(e.target.value)} />
              </div>
            </div>

            <div className="hw-form-section">
              <h4>Bên giao</h4>
              <div className="form-group">
                <label>Người giao hàng</label>
                <input className="form-control" value={delivererName} onChange={e => setDelivererName(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Điện thoại</label>
                <input className="form-control" value={delivererPhone} onChange={e => setDelivererPhone(e.target.value)} />
              </div>
            </div>

            <div className="hw-form-section">
              <h4>Bên nhận</h4>
              <div className="form-group">
                <label>Người nhận</label>
                <input className="form-control" placeholder="Họ tên người nhận" value={receiverName} onChange={e => setReceiverName(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Điện thoại</label>
                <input className="form-control" value={receiverPhone} onChange={e => setReceiverPhone(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Công ty / Đơn vị</label>
                <input className="form-control" value={receiverCompany} onChange={e => setReceiverCompany(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Địa chỉ giao hàng</label>
                <textarea className="form-control" rows={2} value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)} />
              </div>
            </div>

            <div className="hw-form-section">
              <h4>Danh sách hàng hóa</h4>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign:"left", padding:"3px 3px", fontWeight:600, color:"#666", borderBottom:"1px solid #e5e3dc" }}>Tên hàng</th>
                    <th style={{ width:36, textAlign:"center", padding:"3px", borderBottom:"1px solid #e5e3dc", fontWeight:600, color:"#666" }}>SL</th>
                    <th style={{ width:42, textAlign:"center", padding:"3px", borderBottom:"1px solid #e5e3dc", fontWeight:600, color:"#666" }}>ĐVT</th>
                    <th style={{ width:70, textAlign:"center", padding:"3px", borderBottom:"1px solid #e5e3dc", fontWeight:600, color:"#666" }}>Serial/SN</th>
                    <th style={{ width:20, borderBottom:"1px solid #e5e3dc" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <React.Fragment key={it.id}>
                      <tr>
                        <td style={{ padding:"2px 3px" }}>
                          <input style={{ width:"100%", border:"1px solid #d1cfc6", borderRadius:3, padding:"2px 4px", fontSize:11, fontFamily:"inherit" }}
                            value={it.name} onChange={e => setField(it.id, "name", e.target.value)} placeholder={`Hàng ${i+1}`} />
                        </td>
                        <td style={{ padding:"2px 3px" }}>
                          <input type="number" style={{ width:"100%", border:"1px solid #d1cfc6", borderRadius:3, padding:"2px 3px", fontSize:11, textAlign:"center", fontFamily:"inherit" }}
                            value={it.qty} onChange={e => setField(it.id, "qty", e.target.value)} />
                        </td>
                        <td style={{ padding:"2px 3px" }}>
                          <input style={{ width:"100%", border:"1px solid #d1cfc6", borderRadius:3, padding:"2px 3px", fontSize:11, fontFamily:"inherit" }}
                            value={it.unit} onChange={e => setField(it.id, "unit", e.target.value)} />
                        </td>
                        <td style={{ padding:"2px 3px" }}>
                          <input style={{ width:"100%", border:"1px solid #d1cfc6", borderRadius:3, padding:"2px 3px", fontSize:11, fontFamily:"inherit" }}
                            value={it.serial} onChange={e => setField(it.id, "serial", e.target.value)} placeholder="…" />
                        </td>
                        <td style={{ textAlign:"center", padding:"2px 1px" }}>
                          {items.length > 1 && (
                            <button onClick={() => removeItem(it.id)} style={{ background:"none", border:"none", color:"#dc2626", cursor:"pointer", fontSize:14, padding:"1px" }}>×</button>
                          )}
                        </td>
                      </tr>
                      {lang !== "vi" ? (
                        <tr>
                          <td colSpan={5} style={{ padding: "0 3px 4px 3px" }}>
                            <input 
                              style={{ width: "100%", border: "1px dashed #2563eb", borderRadius: 3, padding: "2px 4px", fontSize: 11, fontStyle: "italic", background: "#eff6ff", color: "#1e40af" }}
                              value={it.nameEn || ""} 
                              onChange={e => setField(it.id, "nameEn", e.target.value)} 
                              placeholder={`Tên tiếng ${lang === "vi_en" ? "Anh" : "Trung"}...`} 
                            />
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              <button className="btn btn-ghost btn-sm" style={{ marginTop:8 }} onClick={addItem}>+ Thêm dòng</button>
            </div>

            <div className="hw-form-section">
              <h4>Ghi chú</h4>
              <div className="form-group">
                <textarea className="form-control" rows={2} placeholder="Ghi chú thêm (nếu có)..." value={note} onChange={e => setNote(e.target.value)} />
              </div>
              {lang !== "vi" ? (
                <div className="form-group">
                  <label style={{ fontSize: 11, color: "#666" }}>Dịch ghi chú ({lang === "vi_en" ? "English" : "中文"})</label>
                  <textarea className="form-control" rows={2} placeholder="Ghi chú dịch..." value={noteEn} onChange={e => setNoteEn(e.target.value)} />
                </div>
              ) : null}
            </div>
          </div>

          {/* Right: Preview */}
          <div style={{ flex:1, overflowY:"auto" }}>
            <div id="deliveryPreviewContent" style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", padding:28, maxWidth:794, margin:"0 auto", background:"#fff", fontSize:13, color:"#000" }}>
              {/* Header */}
              <table style={{ width:"100%", borderCollapse:"collapse", marginBottom:14 }}>
                <tbody>
                  <tr>
                    <td style={{ width:"55%", verticalAlign:"top", paddingRight:12, borderRight:"2px solid #1a2540" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                        <img src={getLogoUrl()} style={{ width:48, height:48, objectFit:"contain" }} alt="PMC" />
                        <div>
                          <div style={{ fontWeight:700, fontSize:13 }}>{COMPANY.name}</div>
                          <div style={{ fontSize:10, color:"#555" }}>Địa chỉ: {COMPANY.address}</div>
                          <div style={{ fontSize:10, color:"#555" }}>ĐT: {COMPANY.phone} | Email: {COMPANY.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign:"center", paddingLeft:12, verticalAlign:"top" }}>
                      <div style={{ fontWeight:700, fontSize:12 }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                      <div style={{ fontWeight:600, fontSize:12 }}>Độc lập – Tự do – Hạnh phúc</div>
                      <div style={{ fontSize:11, marginTop:4 }}>⸻⸻⸻</div>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Title */}
              <div style={{ textAlign:"center", margin:"14px 0 18px" }}>
                <div style={{ fontSize:18, fontWeight:700, color:"#1a2540", textTransform:"uppercase", letterSpacing:"0.05em" }}>{T.title}</div>
                {lang !== "vi" && T.titleB ? (
                  <div style={{ fontSize:12, fontStyle:"italic", color:"#555", marginTop:2 }}>{T.titleB}</div>
                ) : null}
                <div style={{ fontSize:11, color:"#666", marginTop:3 }}>{T.ref}: <strong>{refNum}</strong></div>
                <div style={{ fontSize:11, color:"#666" }}>{dateStr}</div>
              </div>

              {/* Info */}
              <table style={{ width:"100%", borderCollapse:"collapse", marginBottom:14, fontSize:12 }}>
                <tbody>
                  <tr>
                    <td style={{ width:"50%", verticalAlign:"top", paddingRight:16 }}>
                      <div style={{ fontWeight:700, color:"#1a2540", marginBottom:6, fontSize:12, borderBottom:"1px solid #e5e3dc", paddingBottom:4 }}>{T.partyA}</div>
                      <div><span style={{ color:"#555", minWidth:120, display:"inline-block" }}>{T.company}</span> <strong>{COMPANY.name}</strong></div>
                      <div><span style={{ color:"#555", minWidth:120, display:"inline-block" }}>{T.deliverer}</span> <strong>{delivererName || "……………………………"}</strong></div>
                      <div><span style={{ color:"#555", minWidth:120, display:"inline-block" }}>{T.phone}</span> {delivererPhone || "……………………………"}</div>
                    </td>
                    <td style={{ width:"50%", verticalAlign:"top", paddingLeft:16, borderLeft:"1px solid #e5e3dc" }}>
                      <div style={{ fontWeight:700, color:"#1a2540", marginBottom:6, fontSize:12, borderBottom:"1px solid #e5e3dc", paddingBottom:4 }}>{T.partyB}</div>
                      <div><span style={{ color:"#555", minWidth:120, display:"inline-block" }}>{T.receiver}</span> <strong>{receiverName || "……………………………"}</strong></div>
                      <div><span style={{ color:"#555", minWidth:120, display:"inline-block" }}>{T.phone}</span> {receiverPhone || "……………………………"}</div>
                      {receiverCompany && <div><span style={{ color:"#555", minWidth:120, display:"inline-block" }}>{T.unit}</span> {receiverCompany}</div>}
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Delivery Address */}
              {deliveryAddress && (
                <div style={{ marginBottom:14, fontSize:12, background:"#f9f8f5", borderLeft:"3px solid #1a2540", padding:"8px 12px", borderRadius:"0 4px 4px 0" }}>
                  📍 <strong>{T.address}</strong> {deliveryAddress}
                </div>
              )}

              {/* Items Table */}
              <table className="handover-items-table" style={{ width:"100%", tableLayout:"fixed", marginBottom:14 }}>
                <thead>
                  <tr>
                    <th style={{ width:"8%", textAlign:"center", wordBreak:"break-word", overflowWrap:"break-word", whiteSpace:"normal" }}>{T.colStt}</th>
                    <th style={{ width:"44%", textAlign:"left", wordBreak:"break-word", overflowWrap:"break-word", wordWrap:"break-word" }}>{T.colItem}</th>
                    <th style={{ width:"15%", textAlign:"center", wordBreak:"break-word", overflowWrap:"break-word", whiteSpace:"normal" }}>{T.colQty}</th>
                    <th style={{ width:"11%", textAlign:"center", wordBreak:"break-word", overflowWrap:"break-word", whiteSpace:"normal" }}>{T.colUnit}</th>
                    <th style={{ width:"22%", textAlign:"center", wordBreak:"break-word", overflowWrap:"break-word", whiteSpace:"normal" }}>{T.colSerial}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <tr key={it.id}>
                      <td style={{ textAlign:"center", whiteSpace:"nowrap" }}>{i+1}</td>
                      <td style={{ textAlign:"left", wordBreak:"break-word", overflowWrap:"break-word", wordWrap:"break-word" }}>
                        <div>{it.name}</div>
                        {lang !== "vi" && it.nameEn ? (
                          <div style={{ fontSize: "0.85em", fontStyle: "italic", color: "#555" }}>{it.nameEn}</div>
                        ) : null}
                      </td>
                      <td style={{ textAlign:"center", whiteSpace:"nowrap" }}>{it.qty}</td>
                      <td style={{ textAlign:"center", whiteSpace:"nowrap" }}>{it.unit}</td>
                      <td style={{ textAlign:"center", wordBreak:"break-word", overflowWrap:"break-word", color: it.serial ? "#000" : "#bbb" }}>{it.serial || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Note */}
              {note && (
                <div style={{ marginBottom:16, fontSize:12, color:"#444" }}>
                  <div><strong>{T.noteLabel}</strong> {note}</div>
                  {lang !== "vi" && noteEn ? (
                    <div style={{ fontStyle: "italic", color: "#555", marginLeft: 16 }}>{noteEn}</div>
                  ) : null}
                </div>
              )}

              {/* Confirmation */}
              <div style={{ marginBottom:16, fontSize:12, lineHeight:1.8, whiteSpace: "pre-line" }}>
                {T.confirmText}
              </div>

              {/* Signatures */}
              <div style={{ display:"flex", justifyContext:"space-between", marginTop:24, fontSize:12 }}>
                <div style={{ textAlign:"center", minWidth:200 }}>
                  <div style={{ fontWeight:700, color:"#1a2540", marginBottom:2 }}>{T.signDeliverer}</div>
                  <div style={{ color:"#666", fontSize:11 }}>{T.signSub}</div>
                  <div style={{ height:60 }} />
                  <div style={{ fontWeight:600 }}>{delivererName}</div>
                  <div style={{ color:"#666", fontSize:11 }}>{COMPANY.short}</div>
                </div>
                <div style={{ textAlign:"center", minWidth:200, marginLeft:"auto" }}>
                  <div style={{ fontWeight:700, color:"#1a2540", marginBottom:2 }}>{T.signReceiver}</div>
                  <div style={{ color:"#666", fontSize:11 }}>{T.signSub}</div>
                  <div style={{ height:60 }} />
                  <div style={{ fontWeight:600, borderBottom: receiverName ? "none" : "1px solid #333", minWidth:160, display:"inline-block", minHeight:18 }}>
                    {receiverName || ""}
                  </div>
                  <div style={{ color:"#666", fontSize:11, marginTop:3 }}>
                    {receiverCompany || ""}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer no-print">
          <button className="btn btn-ghost" onClick={onClose}>Đóng</button>
          {storageId && (
            <button className="btn btn-ghost" onClick={handleSave} disabled={saving}>
              {saving ? "⏳ Đang lưu..." : "💾 Lưu phiếu"}{saveMsg && <span style={{color:"#16a34a",marginLeft:6}}>{saveMsg}</span>}
            </button>
          )}
          <button className="btn btn-ghost" onClick={handlePDFClick} disabled={pdfLoading} style={{ minWidth:110 }}>
            {pdfLoading ? "⏳ Đang tạo..." : "📄 Xuất PDF"}
          </button>
          <button className="btn btn-primary" onClick={handlePrint}>🖨️ In</button>
        </div>
      </div>
    </div>
  );
}
