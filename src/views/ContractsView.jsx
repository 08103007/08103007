import React, { useState, useEffect } from 'react';
import { _mem } from '../utils/gasStore';
import { fmt, calcItems, getCustomerColor } from '../utils/helpers';

export default function ContractsView({ quotes, onOpenContract }) {
  const [contracts, setContracts] = useState({});
  const [search, setSearch] = useState("");

  useEffect(() => {
    setContracts(_mem.contracts || {});
    const timer = setInterval(() => setContracts({...(_mem.contracts || {})}), 1500);
    return () => clearInterval(timer);
  }, []);

  const rows = Object.values(contracts)
    .map(ct => {
      const quote = quotes.find(q => q.id === ct.quoteId) || null;
      return { ...ct, quote };
    })
    .filter(row => {
      if (!search) return true;
      const s = search.toLowerCase();
      return (
        (row.contractNumber || "").toLowerCase().includes(s) ||
        (row.buyerName || "").toLowerCase().includes(s) ||
        (row.quote?.quoteNumber || "").toLowerCase().includes(s)
      );
    })
    .sort((a, b) => (b.contractNumber || "").localeCompare(a.contractNumber || ""));

  return (
    <div>
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "#1a2540", marginBottom: 4 }}>📃 Hợp đồng</h2>
          <p style={{ color: "#888", fontSize: 13 }}>{rows.length} hợp đồng đã soạn</p>
        </div>
      </div>

      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <input className="search-input" placeholder="🔍 Tìm số HĐ, khách hàng, số BG..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {rows.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 40 }}>📃</div>
          <h3>Chưa có hợp đồng nào</h3>
          <p style={{ fontSize: 13 }}>Mở một báo giá → bấm "Soạn hợp đồng" → Lưu hợp đồng để thấy ở đây</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Số hợp đồng</th>
                  <th>Khách hàng (Bên mua)</th>
                  <th>Liên kết báo giá</th>
                  <th>Ngôn ngữ</th>
                  <th style={{ textAlign: "right" }}>Tổng giá trị</th>
                  <th style={{ textAlign: "center" }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => {
                  const total = row.quote ? calcItems(row.quote.items, row.quote.vatRate).total : 0;
                  const col = getCustomerColor(row.buyerName || row.quote?.customer || "");
                  return (
                    <tr key={row.quoteId}>
                      <td style={{ fontWeight: 600, color: "#1a2540" }}>
                        {row.contractNumber || <span style={{ color: "#aaa", fontStyle: "italic" }}>Chưa đặt số</span>}
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ background: col.bg, color: col.text, borderRadius: 4, padding: "2px 7px", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap" }}>
                            {(row.buyerName || row.quote?.customer || "—").slice(0, 20)}{(row.buyerName || "").length > 20 ? "…" : ""}
                          </span>
                          <span style={{ fontSize: 12, color: "#555" }}>{row.buyerRep || ""}</span>
                        </div>
                      </td>
                      <td>
                        {row.quote ? (
                          <span style={{ fontSize: 12, color: "#1a2540", fontWeight: 500 }}>
                            📋 {row.quote.quoteNumber}
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, color: "#aaa" }}>Báo giá đã xóa</span>
                        )}
                      </td>
                      <td>
                        <span className="badge" style={{ background: "#eef0f8", color: "#1a2540" }}>
                          {row.lang === "vi_zh" ? "🇻🇳 VN – 🇨🇳 CN" : "🇻🇳 VN – 🇬🇧 EN"}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 500 }}>
                        {total > 0 ? fmt(total) + " đ" : <span style={{ color: "#aaa" }}>—</span>}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button className="btn btn-primary btn-sm"
                          onClick={() => row.quote && onOpenContract(row.quote)}
                          disabled={!row.quote}
                          title={row.quote ? "Mở hợp đồng" : "Báo giá đã bị xóa"}>
                          📝 Mở
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
