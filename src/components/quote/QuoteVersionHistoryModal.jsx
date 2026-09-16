import React, { useState } from 'react';
import { fmt, calcItems } from '../../utils/helpers';

export default function QuoteVersionHistoryModal({ versions, currentQuote, onRestore, onClose }) {
  const [selectedVer, setSelectedVer] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const toggleExpand = (verId) => {
    setExpandedId(prev => prev === verId ? null : verId);
  };

  const verList = Array.isArray(versions) ? versions : [];

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: selectedVer ? 880 : 760, width: "95vw", height: "auto", maxHeight: "90vh", display: "flex", flexDirection: "column" }}>
        
        {/* Header */}
        <div className="modal-header" style={{ flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {selectedVer && (
              <button 
                className="btn btn-ghost btn-sm" 
                onClick={() => setSelectedVer(null)}
                style={{ padding: "4px 8px", fontSize: 13 }}
                title="Quay lại danh sách"
              >
                ← Quay lại
              </button>
            )}
            <span className="modal-title">
              {selectedVer ? `👁️ Chi tiết phiên bản (${selectedVer.savedAt || "Khởi tạo"})` : "📜 Lịch sử các phiên bản Báo giá"}
            </span>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          {verList.length === 0 ? (
            <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-muted)" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📜</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Chưa có phiên bản lịch sử nào</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                Mỗi khi bạn lưu báo giá, hệ thống sẽ tự động lưu lại một bản sao snapshot tại đây.
              </div>
            </div>
          ) : selectedVer ? (
            /* ── VIEW FULL DETAIL OF SELECTED VERSION ── */
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              
              {/* Alert notice */}
              <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                <div style={{ fontSize: 13, color: "#1e40af" }}>
                  ℹ️ Bạn đang xem dữ liệu snapshot lưu lúc <strong>{selectedVer.savedAt || "Không rõ"}</strong>. Bấm nút bên phải nếu muốn phục hồi bản này vào báo giá hiện tại.
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  style={{ fontWeight: 700 }}
                  onClick={() => {
                    if (window.confirm(`Khôi phục dữ liệu từ phiên bản (${selectedVer.savedAt})?\nBản báo giá hiện tại sẽ được tự động lưu lại vào Lịch sử.`)) {
                      onRestore(selectedVer);
                      onClose();
                    }
                  }}
                >
                  🔄 Khôi phục bản này vào báo giá
                </button>
              </div>

              {/* General info box */}
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, fontSize: 13 }}>
                  <div>
                    <span style={{ color: "#64748b" }}>Khách hàng:</span>{" "}
                    <strong style={{ color: "#1e293b" }}>{selectedVer.customer || "—"}</strong>
                  </div>
                  {selectedVer.contact && (
                    <div>
                      <span style={{ color: "#64748b" }}>Người liên hệ:</span>{" "}
                      <strong>{selectedVer.contact}</strong>
                    </div>
                  )}
                  {selectedVer.phone && (
                    <div>
                      <span style={{ color: "#64748b" }}>Điện thoại:</span>{" "}
                      <strong>{selectedVer.phone}</strong>
                    </div>
                  )}
                  {selectedVer.taxId && (
                    <div>
                      <span style={{ color: "#64748b" }}>Mã số thuế:</span>{" "}
                      <strong>{selectedVer.taxId}</strong>
                    </div>
                  )}
                  {selectedVer.address && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <span style={{ color: "#64748b" }}>Địa chỉ:</span>{" "}
                      <span>{selectedVer.address}</span>
                    </div>
                  )}
                  {selectedVer.workContent && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <span style={{ color: "#64748b" }}>Nội dung công việc:</span>{" "}
                      <strong style={{ color: "#1e40af" }}>{selectedVer.workContent}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>📦 Danh sách hàng hóa & dịch vụ ({(selectedVer.items || []).length} mục)</span>
                  <span style={{ fontSize: 12, color: "#64748b", fontWeight: 400 }}>Thuế suất VAT: {selectedVer.vatRate !== undefined ? selectedVer.vatRate : 8}%</span>
                </div>
                
                <div style={{ border: "1px solid #e2e8f0", borderRadius: 6, overflow: "hidden" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5, textAlign: "left" }}>
                    <thead>
                      <tr style={{ background: "#f1f5f9", color: "#334155", fontWeight: 700, borderBottom: "1px solid #cbd5e1" }}>
                        <th style={{ padding: "8px 6px", textAlign: "center", width: 36 }}>#</th>
                        <th style={{ padding: "8px 10px" }}>Tên hàng hóa, quy cách kỹ thuật</th>
                        <th style={{ padding: "8px 6px", textAlign: "center", width: 60 }}>ĐVT</th>
                        <th style={{ padding: "8px 6px", textAlign: "center", width: 50 }}>SL</th>
                        <th style={{ padding: "8px 10px", textAlign: "right", width: 110 }}>Đơn giá</th>
                        <th style={{ padding: "8px 10px", textAlign: "right", width: 120 }}>Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedVer.items || []).map((it, idx) => {
                        const lineTotal = (Number(it.qty) || 0) * (Number(it.price) || 0);
                        return (
                          <tr key={it.id || idx} style={{ borderBottom: "1px solid #f1f5f9", background: idx % 2 === 0 ? "#ffffff" : "#fcfcfd" }}>
                            <td style={{ padding: "8px 6px", textAlign: "center", color: "#64748b" }}>{idx + 1}</td>
                            <td style={{ padding: "8px 10px" }}>
                              <div style={{ fontWeight: 600, color: "#0f172a" }}>{it.name || "—"}</div>
                              {it.note && <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{it.note}</div>}
                            </td>
                            <td style={{ padding: "8px 6px", textAlign: "center", color: "#475569" }}>{it.unit || "Cái"}</td>
                            <td style={{ padding: "8px 6px", textAlign: "center", fontWeight: 700, color: "#0f172a" }}>{it.qty || 1}</td>
                            <td style={{ padding: "8px 10px", textAlign: "right", color: "#334155" }}>{fmt(it.price || 0)} đ</td>
                            <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#1e3a8a" }}>{fmt(lineTotal)} đ</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Financial Summary */}
              {(() => {
                const calc = calcItems(selectedVer.items || [], selectedVer.vatRate !== undefined ? selectedVer.vatRate : 8);
                return (
                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: 14, alignSelf: "flex-end", width: "100%", maxWidth: 360, marginLeft: "auto" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                      <span style={{ color: "#64748b" }}>Cộng tiền hàng:</span>
                      <strong style={{ color: "#0f172a" }}>{fmt(calc.subtotal)} đ</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                      <span style={{ color: "#64748b" }}>Tiền thuế VAT ({selectedVer.vatRate !== undefined ? selectedVer.vatRate : 8}%):</span>
                      <strong style={{ color: "#0f172a" }}>{fmt(calc.vat)} đ</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, paddingTop: 6, borderTop: "1px solid #cbd5e1", color: "#1e3a8a" }}>
                      <span style={{ fontWeight: 800 }}>TỔNG CỘNG THANH TOÁN:</span>
                      <strong style={{ fontWeight: 800, fontSize: 15 }}>{fmt(calc.total)} đ</strong>
                    </div>
                  </div>
                );
              })()}

              {/* Notes of this version */}
              {selectedVer.notes && (
                <div style={{ fontSize: 12, color: "#475569", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 6, padding: 10 }}>
                  <div style={{ fontWeight: 700, color: "#334155", marginBottom: 4 }}>Ghi chú & điều khoản của phiên bản này:</div>
                  <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{selectedVer.notes}</div>
                </div>
              )}

            </div>
          ) : (
            /* ── VERSION LIST VIEW ── */
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 2 }}>
                💡 Bấm <strong>"👁️ Xem chi tiết"</strong> để kiểm tra đầy đủ danh sách hàng hóa và giá của phiên bản cũ trước khi quyết định phục hồi:
              </div>

              {verList.map((ver, i) => {
                const isExpanded = expandedId === (ver.versionId || i);
                const itemCount = (ver.items || []).length;
                const calc = calcItems(ver.items || [], ver.vatRate !== undefined ? ver.vatRate : 8);

                return (
                  <div
                    key={ver.versionId || i}
                    style={{
                      background: "#fff",
                      border: "1px solid var(--border-color)",
                      borderRadius: 8,
                      overflow: "hidden",
                      transition: "border-color 0.15s ease"
                    }}
                  >
                    {/* Version Row Item */}
                    <div
                      style={{
                        padding: "12px 14px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        flexWrap: "wrap",
                        background: isExpanded ? "#f8fafc" : "#ffffff",
                        borderBottom: isExpanded ? "1px solid #e2e8f0" : "none"
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: 700, color: "var(--primary)", fontSize: 14 }}>
                            Phiên bản v{verList.length - i}
                          </span>
                          <span style={{ fontSize: 11, background: "#f1f5f9", color: "#475569", padding: "1px 6px", borderRadius: 4 }}>
                            📅 {ver.savedAt || "Khởi tạo"}
                          </span>
                        </div>
                        <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>
                          Khách hàng: <strong style={{ color: "#1e293b" }}>{ver.customer || "Chưa nhập"}</strong> &bull; <span>{itemCount} mặt hàng</span>
                        </div>
                        <div style={{ fontSize: 13, color: "var(--accent)", fontWeight: 700, marginTop: 3 }}>
                          Tổng cộng: {fmt(ver.total || calc.total || 0)} đ
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 12 }}
                          onClick={() => setSelectedVer(ver)}
                        >
                          👁️ Xem chi tiết
                        </button>

                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: 12, color: "#475569" }}
                          onClick={() => toggleExpand(ver.versionId || i)}
                        >
                          {isExpanded ? "▲ Thu gọn" : "▼ Xem nhanh"}
                        </button>

                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          style={{ fontSize: 12, fontWeight: 600 }}
                          onClick={() => {
                            if (window.confirm(`Khôi phục dữ liệu phiên bản v${verList.length - i} (${ver.savedAt})?\nBản báo giá hiện tại sẽ được tự động lưu lại vào Lịch sử.`)) {
                              onRestore(ver);
                              onClose();
                            }
                          }}
                        >
                          🔄 Phục hồi
                        </button>
                      </div>
                    </div>

                    {/* Quick Expand Preview */}
                    {isExpanded && (
                      <div style={{ padding: "12px 14px", background: "#fafafa", fontSize: 12 }}>
                        <div style={{ fontWeight: 700, color: "#334155", marginBottom: 6 }}>Danh sách mặt hàng phiên bản này:</div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4, maxHeight: 150, overflowY: "auto" }}>
                          {(ver.items || []).map((it, itIdx) => (
                            <div key={itIdx} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", borderBottom: "1px dashed #e5e7eb" }}>
                              <span style={{ color: "#1e293b" }}>{itIdx + 1}. <strong>{it.name || "Chưa có tên"}</strong> (x{it.qty || 1} {it.unit || "Cái"})</span>
                              <span style={{ color: "#1e3a8a", fontWeight: 600 }}>{fmt((it.qty || 1) * (it.price || 0))} đ</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ textAlign: "right", marginTop: 8 }}>
                          <button
                            className="btn btn-ghost btn-xs"
                            style={{ color: "#2563eb", fontWeight: 600 }}
                            onClick={() => setSelectedVer(ver)}
                          >
                            👁️ Mở toàn bộ chi tiết phiên bản này →
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            {selectedVer ? (
              <button className="btn btn-ghost btn-sm" onClick={() => setSelectedVer(null)}>
                ← Quay lại danh sách ({verList.length} bản)
              </button>
            ) : (
              <span>Tổng số: <strong>{verList.length}</strong> phiên bản được lưu</span>
            )}
          </div>
          <button className="btn btn-ghost" onClick={onClose}>Đóng</button>
        </div>

      </div>
    </div>
  );
}

