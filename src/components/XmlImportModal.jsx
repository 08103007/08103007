import React, { useState, useRef } from 'react';
import { fmt } from '../utils/helpers';

export default function XmlImportModal({ onImport, onClose }) {
  const [items, setItems]       = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [error, setError]       = useState("");
  const [fileName, setFileName] = useState("");
  const fileRef = useRef(null);

  const parseXml = (text) => {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "application/xml");
      const parseErr = doc.querySelector("parsererror");
      if (parseErr) throw new Error("File XML không hợp lệ");

      const nodes = doc.querySelectorAll("HHDVu, ChiTiet, Item, InvoiceItem, HangHoa");
      if (nodes.length === 0) throw new Error("Không tìm thấy dòng hàng hóa trong file XML");

      const result = [];
      nodes.forEach((node, i) => {
        const getVal = (...tags) => {
          for (const t of tags) {
            const el = node.querySelector(t);
            if (el && el.textContent.trim()) return el.textContent.trim();
          }
          return "";
        };

        const name = getVal("THHDVu", "TenHH", "tenHangHoa", "itemName", "TenHangHoa", "Ten");
        const unit = getVal("DVTinh", "DonViTinh", "donViTinh", "unit", "DVT") || "Cái";
        const qtyStr = getVal("SLuong", "soLuong", "quantity", "SoLuong", "SL");
        const priceStr = getVal("DGia", "donGia", "unitPrice", "DonGia", "Gia");
        const vatRateRaw = getVal("TSuat", "thueVAT", "vatRate", "ThueVAT", "TS", "TSuatVAT");

        const qty = parseFloat(qtyStr.replace(/,/g, "")) || 1;
        const price = parseFloat(priceStr.replace(/,/g, "")) || 0;

        let vatRate = undefined;
        if (vatRateRaw) {
          const vr = vatRateRaw.replace("%", "").trim().toUpperCase();
          if (vr === "KCT" || vr === "KK" || vr === "KCTUE" || vr === "KHONG") vatRate = -1;
          else {
            const n = parseFloat(vr);
            if (!isNaN(n)) vatRate = n;
          }
        }

        if (name) {
          result.push({
            id: i,
            name,
            unit,
            qty: qty > 0 ? qty : 1,
            price: price >= 0 ? price : 0,
            vatRate
          });
        }
      });

      if (result.length === 0) throw new Error("Không đọc được tên hàng hóa từ file XML");
      setItems(result);
      setSelected(new Set(result.map(it => it.id)));
      setError("");
    } catch(e) {
      setError(e.message);
      setItems([]);
    }
  };

  const handleFile = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => parseXml(ev.target.result);
    reader.readAsText(file, "utf-8");
  };

  const toggleAll = (checked) => {
    setSelected(checked ? new Set(items.map(it => it.id)) : new Set());
  };

  const toggleOne = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleImport = () => {
    const chosen = items.filter(it => selected.has(it.id));
    if (chosen.length === 0) { alert("Chưa chọn mặt hàng nào"); return; }
    onImport(chosen);
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:580, height:"auto", maxHeight:"90vh" }}>
        <div className="modal-header">
          <span className="modal-title">📄 Nhập hàng hóa từ XML hóa đơn điện tử</span>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">

          <div style={{ border:"2px dashed #d1cfc6", borderRadius:8, padding:"20px", textAlign:"center", marginBottom:16, cursor:"pointer", background:"#fafaf7" }}
            onClick={() => fileRef.current && fileRef.current.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) { setFileName(f.name); const r = new FileReader(); r.onload = ev => parseXml(ev.target.result); r.readAsText(f,"utf-8"); } }}>
            <div style={{ fontSize:28, marginBottom:6 }}>📂</div>
            <div style={{ fontSize:13, color:"#555" }}>{fileName || "Click hoặc kéo thả file XML hóa đơn vào đây"}</div>
            <div style={{ fontSize:11, color:"#aaa", marginTop:4 }}>Hỗ trợ file XML hóa đơn điện tử chuẩn Việt Nam</div>
            <input ref={fileRef} type="file" accept=".xml,text/xml,application/xml" style={{ display:"none" }} onChange={handleFile} />
          </div>

          {error && (
            <div style={{ background:"#fee2e2", color:"#dc2626", padding:"10px 14px", borderRadius:6, fontSize:13, marginBottom:12 }}>
              ❌ {error}
            </div>
          )}

          {items.length > 0 && (
            <>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:8 }}>
                <div style={{ fontSize:13, fontWeight:600, color:"#1a2540" }}>
                  Tìm thấy {items.length} mặt hàng — chọn để thêm vào báo giá:
                </div>
                <label style={{ fontSize:12, color:"#666", cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>
                  <input type="checkbox"
                    checked={selected.size === items.length}
                    onChange={e => toggleAll(e.target.checked)} />
                  Chọn tất cả
                </label>
              </div>
              <div className="card" style={{ maxHeight:320, overflowY:"auto" }}>
                {items.map(it => (
                  <div key={it.id} className="xml-result-item" onClick={() => toggleOne(it.id)} style={{ cursor:"pointer", padding:"8px 12px", borderBottom:"1px solid #f0efe9", display:"flex", alignItems:"center", gap:10 }}>
                    <input type="checkbox" checked={selected.has(it.id)} onChange={() => toggleOne(it.id)}
                      onClick={e => e.stopPropagation()} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:500, color:"#1a2540" }}>{it.name}</div>
                      <div style={{ fontSize:11, color:"#666", marginTop:2, display:"flex", gap:12, flexWrap:"wrap" }}>
                        <span>ĐVT: <strong>{it.unit}</strong></span>
                        <span>SL: <strong>{it.qty}</strong></span>
                        <span>Đơn giá nhập chưa VAT: <strong>{fmt(it.price)} đ</strong></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize:12, color:"#888", marginTop:8, textAlign:"right" }}>
                Đã chọn: <strong>{selected.size}</strong> / {items.length}
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Hủy</button>
          {items.length > 0 && (
            <button className="btn btn-primary" onClick={handleImport} disabled={selected.size === 0}>
              ✅ Thêm {selected.size} mặt hàng vào báo giá
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
