import React, { useState, useEffect } from 'react';
import { COMPANY, _mem } from '../utils/gasStore';
import { fmt, todayStr } from '../utils/helpers';
import { upsertSupabaseDebtRecs } from '../utils/supabaseClient';

export default function DebtReconciliationModal({ onClose, onOpenPaymentRequest }) {
  const [selectedQuoteId, setSelectedQuoteId] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerTax, setBuyerTax] = useState("");
  const [buyerAddr, setBuyerAddr] = useState("");
  const [refNum, setRefNum] = useState(`DCCN-${Date.now().toString().slice(-6)}`);
  const [dateStr, setDateStr] = useState(todayStr());
  const [items, setItems] = useState([]);
  const [vatRate, setVatRate] = useState(8);
  const [lang, setLang] = useState("vi");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  const quotesList = Array.isArray(_mem.quotes) ? _mem.quotes : [];

  // When a quote is selected, populate items and customer info
  const handleSelectQuote = (qId) => {
    setSelectedQuoteId(qId);
    const q = quotesList.find(item => item.id === qId);
    if (q) {
      setBuyerName(q.customer || "");
      setBuyerTax(q.taxCode || "");
      setBuyerAddr(q.address || "");
      setRefNum(`DCCN-${q.quoteNumber || q.id}`);
      setVatRate(q.vatRate !== undefined ? q.vatRate : 8);
      const qItems = Array.isArray(q.items) ? q.items : [];
      setItems(qItems.map(it => ({
        name: it.name || "",
        unit: it.unit || "Cái",
        qty: Number(it.qty || 1),
        price: Number(it.price || 0),
        amount: Number(it.qty || 1) * Number(it.price || 0)
      })));
    }
  };

  const subtotal = items.reduce((s, it) => s + (Number(it.amount) || 0), 0);
  const vatAmount = vatRate > 0 ? Math.round(subtotal * vatRate / 100) : 0;
  const grandTotal = subtotal + vatAmount;

  const handleSaveToCloud = async () => {
    setSaving(true);
    setSaveMsg("");
    try {
      const record = {
        id: refNum,
        refNum: refNum,
        buyerName: buyerName,
        buyerTax: buyerTax,
        buyerAddr: buyerAddr,
        dateStr: dateStr,
        vatRate: vatRate,
        subtotal: subtotal,
        vatAmount: vatAmount,
        grandTotal: grandTotal,
        items: items,
        updatedAt: new Date().toISOString()
      };
      _mem.debtRecs = _mem.debtRecs || {};
      _mem.debtRecs[refNum] = record;
      await upsertSupabaseDebtRecs({ [refNum]: record });
      setSaveMsg("✅ Đã lưu Biên bản đối chiếu công nợ lên Supabase Cloud!");
      setTimeout(() => setSaveMsg(""), 3000);
    } catch (e) {
      setSaveMsg("⚠️ Lỗi lưu Cloud: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100vw",
      height: "100vh",
      background: "#0f172a",
      zIndex: 999999,
      display: "flex",
      flexDirection: "column",
      color: "#f8fafc",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
    }}>
      {/* Top Action Bar */}
      <div className="no-print" style={{
        background: "#1e293b",
        borderBottom: "1px solid #334155",
        padding: "12px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#38bdf8", margin: 0 }}>
            📋 BIÊN BẢN ĐỐI CHIẾU CÔNG NỢ
          </h2>
          <span style={{ fontSize: 12, background: "#0369a1", padding: "3px 8px", borderRadius: 4 }}>
            Supabase Cloud Mode
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {saveMsg && <span style={{ fontSize: 13, color: "#4ade80", fontWeight: 600 }}>{saveMsg}</span>}
          <button
            onClick={handleSaveToCloud}
            disabled={saving}
            style={{
              background: "#16a34a", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 6, fontWeight: 600, cursor: "pointer"
            }}
          >
            💾 {saving ? "Đang lưu..." : "Lưu Cloud"}
          </button>

          <button
            onClick={() => onOpenPaymentRequest && onOpenPaymentRequest({ buyerName, grandTotal, refNum })}
            style={{
              background: "#0284c7", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 6, fontWeight: 600, cursor: "pointer"
            }}
          >
            📑 Tạo Đề Nghị Thanh Toán
          </button>

          <button
            onClick={handlePrint}
            style={{
              background: "#475569", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 6, fontWeight: 600, cursor: "pointer"
            }}
          >
            🖨️ In (A4)
          </button>

          <button
            onClick={onClose}
            style={{
              background: "#dc2626", color: "#fff", border: "none", padding: "8px 16px", borderRadius: 6, fontWeight: 600, cursor: "pointer"
            }}
          >
            ❌ Đóng
          </button>
        </div>
      </div>

      {/* Main Body */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left Form Controls Panel */}
        <div className="no-print" style={{
          width: 340,
          background: "#1e293b",
          borderRight: "1px solid #334155",
          padding: 20,
          overflowY: "auto"
        }}>
          <h3 style={{ fontSize: 14, color: "#94a3b8", marginBottom: 14 }}>1. Chọn Báo giá mẫu</h3>
          <select
            value={selectedQuoteId}
            onChange={(e) => handleSelectQuote(e.target.value)}
            style={{
              width: "100%", padding: "8px 12px", background: "#0f172a", border: "1px solid #475569", color: "#fff", borderRadius: 6, marginBottom: 16
            }}
          >
            <option value="">-- Chọn Báo giá từ Hệ thống --</option>
            {quotesList.map(q => (
              <option key={q.id} value={q.id}>
                {q.quoteNumber || q.id} - {q.customer} ({fmt(q.total)}đ)
              </option>
            ))}
          </select>

          <h3 style={{ fontSize: 14, color: "#94a3b8", marginBottom: 14 }}>2. Thông tin bên mua (Khách hàng)</h3>
          <label style={{ fontSize: 12, color: "#cbd5e1" }}>Tên Đơn Vị / Khách Hàng</label>
          <input
            type="text" value={buyerName} onChange={e => setBuyerName(e.target.value)}
            style={{ width: "100%", padding: 8, background: "#0f172a", border: "1px solid #475569", color: "#fff", borderRadius: 6, marginBottom: 12 }}
          />

          <label style={{ fontSize: 12, color: "#cbd5e1" }}>Mã Số Thuế</label>
          <input
            type="text" value={buyerTax} onChange={e => setBuyerTax(e.target.value)}
            style={{ width: "100%", padding: 8, background: "#0f172a", border: "1px solid #475569", color: "#fff", borderRadius: 6, marginBottom: 12 }}
          />

          <label style={{ fontSize: 12, color: "#cbd5e1" }}>Địa Chỉ</label>
          <input
            type="text" value={buyerAddr} onChange={e => setBuyerAddr(e.target.value)}
            style={{ width: "100%", padding: 8, background: "#0f172a", border: "1px solid #475569", color: "#fff", borderRadius: 6, marginBottom: 12 }}
          />

          <label style={{ fontSize: 12, color: "#cbd5e1" }}>Thuế VAT (%)</label>
          <input
            type="number" value={vatRate} onChange={e => setVatRate(Number(e.target.value))}
            style={{ width: "100%", padding: 8, background: "#0f172a", border: "1px solid #475569", color: "#fff", borderRadius: 6, marginBottom: 12 }}
          />
        </div>

        {/* Right Printable A4 Document Preview */}
        <div style={{ flex: 1, padding: 30, overflowY: "auto", background: "#334155", display: "flex", justifyContent: "center" }}>
          <div className="print-page" style={{
            width: "210mm",
            minHeight: "297mm",
            background: "#fff",
            color: "#000",
            padding: "20mm",
            boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
            fontSize: 13,
            lineHeight: 1.5
          }}>
            {/* Header Company Info */}
            <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #000", paddingBottom: 12, marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{COMPANY.name}</h2>
                <div style={{ fontSize: 11, color: "#333" }}>{COMPANY.address}</div>
                <div style={{ fontSize: 11, color: "#333" }}>MST: {COMPANY.mst} | ĐT: {COMPANY.phone}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700 }}>Số: {refNum}</div>
                <div style={{ fontSize: 11 }}>Ngày: {dateStr}</div>
              </div>
            </div>

            {/* Document Title */}
            <div style={{ textAlign: "center", margin: "20px 0" }}>
              <h1 style={{ fontSize: 18, fontWeight: 800, textTransform: "uppercase", margin: 0 }}>
                BIÊN BẢN ĐỐI CHIẾU CÔNG NỢ
              </h1>
              <div style={{ fontSize: 11, fontStyle: "italic" }}>DEBT RECONCILIATION STATEMENT</div>
            </div>

            {/* Parties Info */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontWeight: 700, textDecoration: "underline", marginBottom: 4 }}>BÊN A (BÊN BÁN):</div>
              <div><b>{COMPANY.name}</b></div>
              <div>Địa chỉ: {COMPANY.address}</div>
              <div>Mã số thuế: {COMPANY.mst}</div>
              <div>Đại diện: <b>{COMPANY.representative}</b> - Chức vụ: {COMPANY.position}</div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ fontWeight: 700, textDecoration: "underline", marginBottom: 4 }}>BÊN B (BÊN MUA):</div>
              <div><b>{buyerName || "......................................................................................."}</b></div>
              <div>Địa chỉ: {buyerAddr || "......................................................................................."}</div>
              <div>Mã số thuế: {buyerTax || "......................................................................................."}</div>
            </div>

            {/* Table of Items */}
            <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16, fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#f1f5f9" }}>
                  <th style={{ border: "1px solid #000", padding: "6px 8px" }}>STT</th>
                  <th style={{ border: "1px solid #000", padding: "6px 8px", textAlign: "left" }}>Tên Hàng Hóa / Dịch Vụ</th>
                  <th style={{ border: "1px solid #000", padding: "6px 8px" }}>ĐVT</th>
                  <th style={{ border: "1px solid #000", padding: "6px 8px" }}>SL</th>
                  <th style={{ border: "1px solid #000", padding: "6px 8px", textAlign: "right" }}>Đơn Giá (đ)</th>
                  <th style={{ border: "1px solid #000", padding: "6px 8px", textAlign: "right" }}>Thành Tiền (đ)</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{ border: "1px solid #000", padding: 12, textAlign: "center", color: "#666" }}>
                      Chưa có hàng hóa nào — chọn Báo giá ở ô bên trái để tải dữ liệu
                    </td>
                  </tr>
                ) : (
                  items.map((it, idx) => (
                    <tr key={idx}>
                      <td style={{ border: "1px solid #000", padding: "6px 8px", textAlign: "center" }}>{idx + 1}</td>
                      <td style={{ border: "1px solid #000", padding: "6px 8px" }}>{it.name}</td>
                      <td style={{ border: "1px solid #000", padding: "6px 8px", textAlign: "center" }}>{it.unit}</td>
                      <td style={{ border: "1px solid #000", padding: "6px 8px", textAlign: "center" }}>{it.qty}</td>
                      <td style={{ border: "1px solid #000", padding: "6px 8px", textAlign: "right" }}>{fmt(it.price)}</td>
                      <td style={{ border: "1px solid #000", padding: "6px 8px", textAlign: "right" }}>{fmt(it.amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan="5" style={{ border: "1px solid #000", padding: "6px 8px", fontWeight: 700, textAlign: "right" }}>Tiền hàng (chưa VAT):</td>
                  <td style={{ border: "1px solid #000", padding: "6px 8px", fontWeight: 700, textAlign: "right" }}>{fmt(subtotal)} đ</td>
                </tr>
                <tr>
                  <td colSpan="5" style={{ border: "1px solid #000", padding: "6px 8px", fontWeight: 700, textAlign: "right" }}>Thuế VAT ({vatRate}%):</td>
                  <td style={{ border: "1px solid #000", padding: "6px 8px", fontWeight: 700, textAlign: "right" }}>{fmt(vatAmount)} đ</td>
                </tr>
                <tr style={{ background: "#f8fafc" }}>
                  <td colSpan="5" style={{ border: "1px solid #000", padding: "8px 8px", fontWeight: 800, textAlign: "right", fontSize: 13 }}>TỔNG CỘNG PHẢI THU:</td>
                  <td style={{ border: "1px solid #000", padding: "8px 8px", fontWeight: 800, textAlign: "right", fontSize: 14, color: "#000" }}>{fmt(grandTotal)} đ</td>
                </tr>
              </tfoot>
            </table>

            {/* Signatures */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 40, textAlign: "center" }}>
              <div style={{ width: "45%" }}>
                <div style={{ fontWeight: 700 }}>ĐẠI DIỆN BÊN MUA (BÊN B)</div>
                <div style={{ fontSize: 11, color: "#555", fontStyle: "italic" }}>(Ký, ghi rõ họ tên & đóng dấu)</div>
                <div style={{ height: 60 }}></div>
                <div style={{ fontWeight: 600 }}>{buyerName || "...................................."}</div>
              </div>
              <div style={{ width: "45%" }}>
                <div style={{ fontWeight: 700 }}>ĐẠI DIỆN BÊN BÁN (BÊN A)</div>
                <div style={{ fontSize: 11, color: "#555", fontStyle: "italic" }}>(Ký, ghi rõ họ tên & đóng dấu)</div>
                <div style={{ height: 60 }}></div>
                <div style={{ fontWeight: 600 }}>{COMPANY.representative}</div>
                <div style={{ fontSize: 11 }}>{COMPANY.name}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
