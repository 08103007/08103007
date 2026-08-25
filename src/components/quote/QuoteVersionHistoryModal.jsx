import React from 'react';
import { fmt } from '../../utils/helpers';

export default function QuoteVersionHistoryModal({ versions, onRestore, onClose }) {
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 640, height: "auto", maxHeight: "85vh" }}>
        <div className="modal-header">
          <span className="modal-title">📜 Lịch sử phiên bản Báo giá (Quote Version History)</span>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          {(!versions || versions.length === 0) ? (
            <div style={{ padding: "30px 0", textAlign: "center", color: "#888" }}>
              Chưa có phiên bản lịch sử nào được ghi nhận cho báo giá này.
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {versions.map((ver, i) => (
                <div
                  key={ver.versionId || i}
                  style={{
                    background: "#fff",
                    border: "1px solid var(--border-color)",
                    borderRadius: 8,
                    padding: 14,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--primary)", fontSize: 14 }}>
                      Phiên bản v{versions.length - i} &bull; {ver.savedAt || "Khởi tạo"}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                      Khách hàng: <strong>{ver.customer || "Chưa nhập"}</strong> &bull; {ver.items ? ver.items.length : 0} mặt hàng
                    </div>
                    <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600, marginTop: 4 }}>
                      Tổng cộng: {fmt(ver.total || 0)} đ
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ borderColor: "var(--accent)", color: "var(--accent)" }}
                    onClick={() => {
                      if (window.confirm(`Khôi phục dữ liệu phiên bản v${versions.length - i}?`)) {
                        onRestore(ver);
                        onClose();
                      }
                    }}
                  >
                    🔄 Khôi phục bản này
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Đóng</button>
        </div>
      </div>
    </div>
  );
}
