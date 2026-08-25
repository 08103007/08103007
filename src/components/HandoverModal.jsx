import React, { useState, useEffect } from 'react';
import { loadHandover, saveHandover, COMPANY, getLogoUrl, showToast } from '../utils/gasStore';
import { generateId } from '../utils/helpers';
import { printElementViaIframe, exportElementToPdf } from '../utils/pdfExporter';

const HANDOVER_T = {
  vi: {
    title: "Biên bản nghiệm thu và bàn giao thiết bị",
    ref: "Số",
    todayText: (d) => `Hôm nay, ngày ${d}, chúng tôi gồm có:`,
    partyA: "BÊN GIAO:",
    partyB: "BÊN NHẬN:",
    mr: "Ông",
    mrMs: "Ông/Bà",
    rep: "Đại diện",
    workContentLabel: "Nội dung công việc",
    itemsHeader: "Thiết bị & dịch vụ gồm có:",
    colStt: "STT",
    colItem: "HÀNG HÓA / DỊCH VỤ",
    colQty: "SỐ LƯỢNG",
    colUnit: "ĐVT",
    evalLabel: "Đánh giá",
    confirmText: "Hai bên thống nhất lập Biên bản bàn giao và nghiệm thu theo những nội dung như trên và được lập thành 02 bản giống nhau, mỗi bên giữ một bản có giá trị tương đương nhau.",
    signPartyA: "BÊN GIAO",
    signPartyB: "BÊN NHẬN",
    signSub: "(Ký và ghi rõ họ tên)"
  },
  vi_en: {
    title: "BIÊN BẢN NGHIỆM THU VÀ BÀN GIAO THIẾT BỊ",
    titleB: "EQUIPMENT ACCEPTANCE AND HANDOVER MINUTES",
    ref: "Số / No",
    todayText: (d) => `Hôm nay, ngày ${d}, chúng tôi gồm có: / Today, dated ${d}, we are:`,
    partyA: "BÊN GIAO (DELIVERER):",
    partyB: "BÊN NHẬN (RECEIVER):",
    mr: "Ông (Mr.)",
    mrMs: "Ông/Bà (Mr./Ms.)",
    rep: "Đại diện (Representative)",
    workContentLabel: "Nội dung công việc (Work content)",
    itemsHeader: "Thiết bị & dịch vụ gồm có: / Equipment & Services include:",
    colStt: "STT / NO.",
    colItem: "HÀNG HÓA / DỊCH VỤ (DESCRIPTION)",
    colQty: "SỐ LƯỢNG (QTY)",
    colUnit: "ĐVT (UNIT)",
    evalLabel: "Đánh giá / Evaluation",
    confirmText: "Hai bên thống nhất lập Biên bản bàn giao và nghiệm thu theo những nội dung như trên và được lập thành 02 bản giống nhau, mỗi bên giữ một bản có giá trị tương đương nhau.\nBoth parties agree to establish the Handover & Acceptance Minutes in 02 identical copies, each party keeping 01 copy of equal legal validity.",
    signPartyA: "BÊN GIAO (DELIVERER)",
    signPartyB: "BÊN NHẬN (RECEIVER)",
    signSub: "(Ký, ghi rõ họ tên / Sign & Full Name)"
  },
  vi_zh: {
    title: "BIÊN BẢN NGHIỆM THU VÀ BÀN GIAO THIẾT BỊ",
    titleB: "设备验收与交接记录",
    ref: "Số / 编号",
    todayText: (d) => `Hôm nay, ngày ${d}, chúng tôi gồm có: / 今天，于 ${d}，我们包括:`,
    partyA: "BÊN GIAO (交货方):",
    partyB: "BÊN NHẬN (收货方):",
    mr: "Ông (先生)",
    mrMs: "Ông/Bà (先生/女士)",
    rep: "Đại diện (代表)",
    workContentLabel: "Nội dung công việc (工作内容)",
    itemsHeader: "Thiết bị & dịch vụ gồm có: / 设备与服务包括:",
    colStt: "STT / 序号",
    colItem: "HÀNG HÓA / DỊCH VỤ (货物/服务)",
    colQty: "SỐ LƯỢNG (数量)",
    colUnit: "ĐVT (单位)",
    evalLabel: "Đánh giá / 评估",
    confirmText: "Hai bên thống nhất lập Biên bản bàn giao và nghiệm thu theo những nội dung như trên và được lập thành 02 bản giống nhau, mỗi bên giữ một bản có giá trị tương đương nhau.\n双方同意按照上述内容制作02份相同的交接验收记录，每方各执01份，具有同等法律效力。",
    signPartyA: "BÊN GIAO (交货方)",
    signPartyB: "BÊN NHẬN (收货方)",
    signSub: "(Ký, ghi rõ họ tên / 签名及全名)"
  }
};

const EVALUATION_TRANSLATIONS = {
  "Tốt": { en: "Good", zh: "良好" },
  "Đạt yêu cầu": { en: "Qualified / Meets requirements", zh: "合格" },
  "Khá": { en: "Fair", zh: "较好" },
  "Cần cải thiện": { en: "Needs Improvement", zh: "需改进" }
};

export default function HandoverModal({ quote, onClose }) {
  const today = new Date();
  const todayFull = `${String(today.getDate()).padStart(2,"0")} tháng ${String(today.getMonth()+1).padStart(2,"0")} năm ${today.getFullYear()}`;

  const [lang, setLang] = useState("vi"); // "vi" | "vi_en" | "vi_zh"
  const [translating, setTranslating] = useState(false);

  const [receiverName, setReceiverName] = useState("");
  const [receiverCompany, setReceiverCompany] = useState(quote ? quote.customer : "");
  const [receiverTitle, setReceiverTitle] = useState("");
  const [delivererName, setDelivererName] = useState("Trần Văn Thịnh");
  const [workContent, setWorkContent] = useState(quote ? (quote.workContent || "") : "");
  const [workContentEn, setWorkContentEn] = useState("");
  const [evaluation, setEvaluation] = useState("Tốt");
  const [dateStr, setDateStr] = useState(todayFull);
  const [refNum, setRefNum] = useState(quote ? ("BBBG-" + (quote.quoteNumber || generateId().slice(0,6).toUpperCase())) : "");
  const [pdfLoading, setPdfLoading] = useState(false);
  const [saving, setSaving]         = useState(false);
  const [saveMsg, setSaveMsg]       = useState("");

  const storageId = quote ? ("hw_" + quote.id) : null;

  const [items, setItems] = useState(() => {
    if (!quote) return [{ id: generateId(), name: "", nameEn: "", qty: 1, unit: "Cái" }];
    return quote.items.map(it => ({ id: it.id, name: it.name, nameEn: "", qty: it.qty, unit: it.unit }));
  });

  const addItem = () => setItems(prev => [...prev, { id: generateId(), name: "", nameEn: "", qty: 1, unit: "Cái" }]);
  const removeItem = (id) => setItems(prev => prev.filter(it => it.id !== id));
  const setItemField = (id, field, val) => setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: val } : it));

  useEffect(() => {
    if (!storageId) return;
    loadHandover(storageId).then(saved => {
      if (!saved) return;
      if (saved.lang)            setLang(saved.lang);
      if (saved.receiverName)    setReceiverName(saved.receiverName);
      if (saved.receiverTitle)   setReceiverTitle(saved.receiverTitle);
      if (saved.delivererName)   setDelivererName(saved.delivererName);
      if (saved.workContent)     setWorkContent(saved.workContent);
      if (saved.workContentEn)   setWorkContentEn(saved.workContentEn);
      if (saved.evaluation)      setEvaluation(saved.evaluation);
      if (saved.dateStr)         setDateStr(saved.dateStr);
      if (saved.refNum)          setRefNum(saved.refNum);

      if (quote) {
        setReceiverCompany(quote.customer);
        const merged = quote.items.map(it => {
          const savedIt = saved.items?.find(s => s.id === it.id || s.name === it.name);
          return {
            id: it.id,
            name: it.name,
            nameEn: savedIt?.nameEn || "",
            qty: it.qty,
            unit: it.unit
          };
        });
        const customItems = saved.items?.filter(s => !quote.items.some(it => it.id === s.id || it.name === s.name)) || [];
        setItems([...merged, ...customItems]);
      } else {
        if (saved.receiverCompany) setReceiverCompany(saved.receiverCompany);
        if (saved.items && saved.items.length) setItems(saved.items);
      }
    }).catch(() => {});
  }, [storageId, quote]);

  const handleSave = async () => {
    if (!storageId) { showToast("⚠️ Cần gắn biên bản vào một báo giá để lưu", 2500); return; }
    setSaving(true);
    try {
      await saveHandover(storageId, { lang, receiverName, receiverCompany, receiverTitle, delivererName, workContent, workContentEn, evaluation, dateStr, refNum, items });
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
      if (workContent) {
        const transWork = await translateStr(workContent);
        setWorkContentEn(transWork);
      }

      const updatedItems = await Promise.all(items.map(async it => {
        if (it.name) {
          const transName = await translateStr(it.name);
          return { ...it, nameEn: transName };
        }
        return it;
      }));
      setItems(updatedItems);
      showToast("✓ Tự động dịch biên bản thành công!", 2000);
    } catch(e) {
      showToast("⚠️ Lỗi tự động dịch: " + e.message, 2500);
    } finally {
      setTranslating(false);
    }
  };

  const handlePrint = () => {
    printElementViaIframe("handoverPreviewContent", `
      .handover-preview * { color:#000 !important; -webkit-print-color-adjust:exact; print-color-adjust:exact; font-family:'Plus Jakarta Sans',sans-serif !important; }
      .handover-items-table { width:100% !important; table-layout:fixed !important; border:1px solid #000 !important; border-collapse:collapse !important; margin:12px 0 !important; }
      .handover-items-table th, .handover-items-table td { border-right:1px solid #000 !important; border-bottom:1px solid #000 !important; padding:5px 7px !important; }
      .handover-items-table th { white-space:normal !important; word-break:break-word !important; overflow-wrap:break-word !important; vertical-align:middle !important; line-height:1.25 !important; }
      .handover-items-table th:nth-child(1), .handover-items-table td:nth-child(1) { width:9% !important; text-align:center !important; }
      .handover-items-table td:nth-child(1) { white-space:nowrap !important; }
      .handover-items-table th:nth-child(2), .handover-items-table td:nth-child(2) { width:62% !important; word-break:break-word !important; overflow-wrap:break-word !important; word-wrap:break-word !important; text-align:left !important; }
      .handover-items-table th:nth-child(3), .handover-items-table td:nth-child(3) { width:16% !important; text-align:center !important; }
      .handover-items-table td:nth-child(3) { white-space:nowrap !important; }
      .handover-items-table th:nth-child(4), .handover-items-table td:nth-child(4) { width:13% !important; text-align:center !important; }
      .handover-items-table td:nth-child(4) { white-space:nowrap !important; }
      .handover-items-table th:last-child, .handover-items-table td:last-child { border-right:none !important; }
      .handover-items-table tr:last-child td { border-bottom:none !important; }
      .handover-header-table td:first-child { border-right:2px solid #000 !important; }
    `);
  };

  const handlePDF = async () => {
    await exportElementToPdf("handoverPreviewContent", {
      filename: "BienBan_" + refNum + ".pdf",
      pad: 36,
    });
  };

  const handlePDFClick = async () => { setPdfLoading(true); try { await handlePDF(); } finally { setPdfLoading(false); } };

  const T = HANDOVER_T[lang] || HANDOVER_T.vi;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 1020 }}>
        <div className="modal-header no-print">
          <span className="modal-title">📋 Biên bản bàn giao & nghiệm thu</span>
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
          <div className="no-print hw-form-col" style={{ width: 330, flexShrink: 0, borderRight: "1px solid #e5e3dc", paddingRight: 20 }}>
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
              <h4>Thông tin biên bản</h4>
              <div className="form-group">
                <label>Số biên bản</label>
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
                <label>Người đại diện</label>
                <input className="form-control" value={delivererName} onChange={e => setDelivererName(e.target.value)} />
              </div>
            </div>
            <div className="hw-form-section">
              <h4>Bên nhận</h4>
              <div className="form-group">
                <label>Ông/Bà</label>
                <input className="form-control" placeholder="Họ tên người nhận" value={receiverName} onChange={e => setReceiverName(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Chức vụ</label>
                <input className="form-control" placeholder="Chức vụ (nếu có)" value={receiverTitle} onChange={e => setReceiverTitle(e.target.value)} />
              </div>
              <div className="form-group">
                <label>Đại diện đơn vị</label>
                <input className="form-control" value={receiverCompany} onChange={e => setReceiverCompany(e.target.value)} />
              </div>
            </div>
            <div className="hw-form-section">
              <h4>Nội dung công việc</h4>
              <div className="form-group">
                <textarea className="form-control" rows={2} placeholder="Mô tả nội dung công việc (Tiếng Việt)..." value={workContent} onChange={e => setWorkContent(e.target.value)} />
              </div>
              {lang !== "vi" ? (
                <div className="form-group">
                  <label style={{ fontSize: 11, color: "#666" }}>Dịch nội dung ({lang === "vi_en" ? "English" : "中文"})</label>
                  <textarea className="form-control" rows={2} placeholder="Nội dung công việc dịch..." value={workContentEn} onChange={e => setWorkContentEn(e.target.value)} />
                </div>
              ) : null}
            </div>

            <div className="hw-form-section">
              <h4>Danh mục thiết bị & dịch vụ</h4>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "4px 4px", fontWeight: 600, color: "#666", borderBottom: "1px solid #e5e3dc" }}>Tên hàng hóa</th>
                    <th style={{ width: 45, textAlign: "center", padding: "4px", borderBottom: "1px solid #e5e3dc", fontWeight: 600, color: "#666" }}>SL</th>
                    <th style={{ width: 50, textAlign: "center", padding: "4px", borderBottom: "1px solid #e5e3dc", fontWeight: 600, color: "#666" }}>ĐVT</th>
                    <th style={{ width: 24, borderBottom: "1px solid #e5e3dc" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, i) => (
                    <React.Fragment key={it.id}>
                      <tr>
                        <td style={{ padding: "3px 4px" }}>
                          <input style={{ width: "100%", border: "1px solid #d1cfc6", borderRadius: 4, padding: "3px 5px", fontSize: 12, fontFamily: "inherit" }}
                            value={it.name} onChange={e => setItemField(it.id, "name", e.target.value)} placeholder={`Hàng hóa ${i + 1}`} />
                        </td>
                        <td style={{ padding: "3px 4px" }}>
                          <input type="number" style={{ width: "100%", border: "1px solid #d1cfc6", borderRadius: 4, padding: "3px 5px", fontSize: 12, textAlign: "center", fontFamily: "inherit" }}
                            value={it.qty} onChange={e => setItemField(it.id, "qty", e.target.value)} />
                        </td>
                        <td style={{ padding: "3px 4px" }}>
                          <input style={{ width: "100%", border: "1px solid #d1cfc6", borderRadius: 4, padding: "3px 5px", fontSize: 12, fontFamily: "inherit" }}
                            value={it.unit} onChange={e => setItemField(it.id, "unit", e.target.value)} />
                        </td>
                        <td style={{ textAlign: "center", padding: "3px 2px" }}>
                          {items.length > 1 && (
                            <button onClick={() => removeItem(it.id)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "2px" }}>×</button>
                          )}
                        </td>
                      </tr>
                      {lang !== "vi" ? (
                        <tr>
                          <td colSpan={4} style={{ padding: "0 4px 4px 4px" }}>
                            <input 
                              style={{ width: "100%", border: "1px dashed #2563eb", borderRadius: 3, padding: "2px 4px", fontSize: 11, fontStyle: "italic", background: "#eff6ff", color: "#1e40af" }}
                              value={it.nameEn || ""} 
                              onChange={e => setItemField(it.id, "nameEn", e.target.value)} 
                              placeholder={`Tên tiếng ${lang === "vi_en" ? "Anh" : "Trung"}...`} 
                            />
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={addItem}>+ Thêm dòng</button>
            </div>

            <div className="hw-form-section">
              <h4>Đánh giá nghiệm thu</h4>
              <div className="form-group">
                <select className="form-control" value={evaluation} onChange={e => setEvaluation(e.target.value)}>
                  <option value="Tốt">Tốt</option>
                  <option value="Đạt yêu cầu">Đạt yêu cầu</option>
                  <option value="Khá">Khá</option>
                  <option value="Cần cải thiện">Cần cải thiện</option>
                </select>
              </div>
            </div>
          </div>

          {/* Right: Preview */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            <div className="handover-preview" id="handoverPreviewContent">
              {/* Header */}
              <table className="handover-header-table">
                <tbody>
                  <tr>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <img src={getLogoUrl()} style={{ width: 50, height: 50, objectFit: "contain" }} alt="PMC" />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{COMPANY.name}</div>
                          <div style={{ fontSize: 10, color: "#555" }}>Địa chỉ: {COMPANY.address}</div>
                          <div style={{ fontSize: 10, color: "#555" }}>ĐT: {COMPANY.phone} | Email: {COMPANY.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 700, fontSize: 12 }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>Độc lập – Tự do – Hạnh phúc</div>
                      <div style={{ fontSize: 11, marginTop: 4 }}>⸻⸻⸻</div>
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* Title */}
              <div className="handover-title">
                <h1 style={{ textTransform: "uppercase" }}>{T.title}</h1>
                {lang !== "vi" && T.titleB ? (
                  <div style={{ fontSize: 13, fontStyle: "italic", color: "#555", marginTop: 2 }}>{T.titleB}</div>
                ) : null}
                {refNum && <div className="ref">{T.ref}: {refNum}</div>}
              </div>

              {/* Body */}
              <div className="handover-body">
                <p>{T.todayText(dateStr)}</p>

                <p><strong>{T.partyA}</strong></p>
                <p style={{ marginLeft: 20 }}>{T.mr}: <strong>{delivererName || "……………………………"}</strong></p>
                <p style={{ marginLeft: 20 }}>{T.rep}: <strong>{COMPANY.name}</strong></p>

                <p style={{ marginTop: 10 }}><strong>{T.partyB}</strong></p>
                <p style={{ marginLeft: 20 }}>{T.mrMs}: <strong>{receiverName || "……………………………………"}</strong>{receiverTitle ? ` – ${receiverTitle}` : ""}</p>
                <p style={{ marginLeft: 20 }}>{T.rep}: <strong>{receiverCompany || "……………………………………………………………"}</strong></p>

                {workContent && (
                  <div style={{ marginTop: 10 }}>
                    <p style={{ margin: "2px 0" }}>– {T.workContentLabel}: {workContent}</p>
                    {lang !== "vi" && workContentEn ? (
                      <p style={{ margin: "0 0 4px", marginLeft: 16, fontStyle: "italic", color: "#555" }}>{workContentEn}</p>
                    ) : null}
                  </div>
                )}

                <p style={{ marginTop: 10 }}>– {T.itemsHeader}</p>

                <table className="handover-items-table" style={{ width:"100%", tableLayout:"fixed", marginBottom:14 }}>
                  <thead>
                    <tr>
                      <th style={{ width: "9%", textAlign:"center", wordBreak:"break-word", overflowWrap:"break-word", whiteSpace:"normal" }}>{T.colStt}</th>
                      <th style={{ width: "62%", textAlign: "left", wordBreak:"break-word", overflowWrap:"break-word", wordWrap:"break-word" }}>{T.colItem}</th>
                      <th style={{ width: "16%", textAlign:"center", wordBreak:"break-word", overflowWrap:"break-word", whiteSpace:"normal" }}>{T.colQty}</th>
                      <th style={{ width: "13%", textAlign:"center", wordBreak:"break-word", overflowWrap:"break-word", whiteSpace:"normal" }}>{T.colUnit}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it, i) => (
                      <tr key={it.id}>
                        <td style={{ textAlign: "center", whiteSpace:"nowrap" }}>{i + 1}</td>
                        <td style={{ textAlign: "left", wordBreak:"break-word", overflowWrap:"break-word", wordWrap:"break-word" }}>
                          <div>{it.name}</div>
                          {lang !== "vi" && it.nameEn ? (
                            <div style={{ fontSize: "0.85em", fontStyle: "italic", color: "#555" }}>{it.nameEn}</div>
                          ) : null}
                        </td>
                        <td style={{ textAlign: "center", whiteSpace:"nowrap" }}>{it.qty}</td>
                        <td style={{ textAlign: "center", whiteSpace:"nowrap" }}>{it.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <p>
                  – {T.evalLabel}: <strong>{evaluation}</strong> 
                  {lang !== "vi" && EVALUATION_TRANSLATIONS[evaluation] ? (
                    <span style={{ fontStyle: "italic", color: "#555", marginLeft: 6 }}>
                      ({lang === "vi_en" ? EVALUATION_TRANSLATIONS[evaluation].en : EVALUATION_TRANSLATIONS[evaluation].zh})
                    </span>
                  ) : null}
                </p>

                <p style={{ marginTop: 12, whiteSpace: "pre-line" }}>
                  {T.confirmText}
                </p>
              </div>

              {/* Signatures */}
              <div className="handover-sign">
                <div className="handover-sign-block">
                  <div className="sign-title">{T.signPartyA}</div>
                  <div className="sign-name">{T.signSub}</div>
                  <div className="sign-space" />
                  <div style={{ fontWeight: 600 }}>{delivererName}</div>
                  <div className="sign-name">{COMPANY.short}</div>
                </div>
                <div className="handover-sign-block">
                  <div className="sign-title">{T.signPartyB}</div>
                  <div className="sign-name">{T.signSub}</div>
                  <div className="sign-space" />
                  <div style={{ fontWeight:600, borderBottom: receiverName ? "none" : "1px solid #333", minWidth:160, display:"inline-block", minHeight:18 }}>
                    {receiverName || ""}
                  </div>
                  <div className="sign-name" style={{ marginTop:3 }}>
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
              {saving ? "⏳ Đang lưu..." : "💾 Lưu biên bản"}{saveMsg && <span style={{color:"#16a34a",marginLeft:6}}>{saveMsg}</span>}
            </button>
          )}
          <button className="btn btn-ghost" onClick={handlePDFClick} disabled={pdfLoading} style={{ minWidth: 110 }}>
            {pdfLoading ? "⏳ Đang tạo..." : "📄 Xuất PDF"}
          </button>
          <button className="btn btn-primary" onClick={handlePrint}>🖨️ In</button>
        </div>
      </div>
    </div>
  );
}
