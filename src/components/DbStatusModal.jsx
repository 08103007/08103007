import React, { useState } from 'react';
import { getSupabaseUrl, hasSupabase, checkSupabaseHealth, getDbSyncStatus } from '../utils/supabaseClient';

export default function DbStatusModal({ onClose, onOpenSettings }) {
  const [checking, setChecking] = useState(false);
  const [diagStatus, setDiagStatus] = useState(() => getDbSyncStatus());

  const handleRecheck = async () => {
    setChecking(true);
    try {
      await checkSupabaseHealth();
      setDiagStatus(getDbSyncStatus());
    } finally {
      setChecking(false);
    }
  };

  const isError = diagStatus.state === "error";
  const isSuccess = diagStatus.state === "success";
  const isSyncing = diagStatus.state === "syncing";
  const isOffline = diagStatus.state === "offline" || !hasSupabase();

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-box" 
        style={{ maxWidth: 620, padding: "24px 28px", borderRadius: 14 }} 
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, borderBottom: "1px solid var(--border-light)", paddingBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>{isError ? "🚨" : isSyncing ? "⏳" : isSuccess ? "🟢" : "💾"}</span>
            <div>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--primary)" }}>
                Tình Trạng Máy Chủ & Ghi Dữ Liệu CSDL
              </h3>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
                Giám sát kết nối Supabase Cloud Database & bộ nhớ máy tính
              </p>
            </div>
          </div>
          <button 
            className="btn btn-ghost" 
            style={{ padding: "4px 10px", fontSize: 16 }} 
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {/* Status Card Banner */}
        <div style={{
          padding: 16,
          borderRadius: 10,
          background: isError ? "#fef2f2" : isSyncing ? "#fffbeb" : isSuccess ? "#f0fdf4" : "#f8fafc",
          border: `1.5px solid ${isError ? "#fca5a5" : isSyncing ? "#fde68a" : isSuccess ? "#86efac" : "#cbd5e1"}`,
          marginBottom: 16
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 14, color: isError ? "#b91c1c" : isSyncing ? "#92400e" : isSuccess ? "#166534" : "#334155" }}>
            <span>{isError ? "⚠️ GẶP SỰ CỐ GHI / ĐỌC CSDL CLOUD" : isSyncing ? "⏳ ĐANG ĐỒNG BỘ DỮ LIỆU LÊN CLOUD..." : isSuccess ? "✅ CSDL CLOUD ĐANG HOẠT ĐỘNG TỐT" : "💾 ĐANG CHẠY CHẾ ĐỘ CỤC BỘ (LOCAL)"}</span>
          </div>
          <div style={{ fontSize: 13, color: isError ? "#991b1b" : "#475569", marginTop: 6, lineHeight: 1.5 }}>
            {diagStatus.message || "Không có cảnh báo nào."}
          </div>
          {diagStatus.detail && (
            <div style={{ fontSize: 12, color: isError ? "#b91c1c" : "#64748b", marginTop: 6, background: "rgba(255,255,255,0.7)", padding: "8px 10px", borderRadius: 6, border: "1px solid rgba(0,0,0,0.06)" }}>
              <strong>Chi tiết:</strong> {diagStatus.detail}
            </div>
          )}
        </div>

        {/* Diagnostic Meta Info */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18, fontSize: 12 }}>
          <div style={{ background: "var(--bg-subtle, #f8fafc)", padding: 10, borderRadius: 8, border: "1px solid var(--border-light, #e2e8f0)" }}>
            <div style={{ color: "var(--text-muted)", fontSize: 11 }}>Địa chỉ Supabase Cloud</div>
            <div style={{ fontWeight: 600, color: "var(--text-main)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {hasSupabase() ? getSupabaseUrl() : "Chưa cấu hình"}
            </div>
          </div>
          <div style={{ background: "var(--bg-subtle, #f8fafc)", padding: 10, borderRadius: 8, border: "1px solid var(--border-light, #e2e8f0)" }}>
            <div style={{ color: "var(--text-muted)", fontSize: 11 }}>Lần lưu Cloud thành công gần nhất</div>
            <div style={{ fontWeight: 600, color: "var(--text-main)", marginTop: 2 }}>
              {diagStatus.lastSuccessTime ? new Date(diagStatus.lastSuccessTime).toLocaleTimeString("vi-VN") : "Chưa có"}
            </div>
          </div>
        </div>

        {/* Safe Storage Notice */}
        <div style={{ padding: "10px 14px", borderRadius: 8, background: "#eff6ff", border: "1px solid #bfdbfe", fontSize: 12, color: "#1e40af", marginBottom: 20, display: "flex", alignItems: "flex-start", gap: 8 }}>
          <span style={{ fontSize: 16 }}>🛡️</span>
          <div>
            <strong>An toàn dữ liệu:</strong> Dữ liệu báo giá, khách hàng, công việc luôn được tự động lưu dự phòng vào <strong>bộ nhớ máy tính (Local Storage)</strong> và tệp JSON. Ngay cả khi mất mạng hoặc máy chủ Cloud bị gián đoạn, dữ liệu của bạn vẫn an toàn tuyệt đối.
          </div>
        </div>

        {/* Modal Actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <button
            className="btn btn-secondary"
            onClick={handleRecheck}
            disabled={checking}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            {checking ? "⏳ Đang kiểm tra..." : "🔄 Thử kết nối lại ngay"}
          </button>

          <div style={{ display: "flex", gap: 8 }}>
            {onOpenSettings && (
              <button
                className="btn btn-primary"
                onClick={() => {
                  onClose();
                  onOpenSettings();
                }}
              >
                ⚙️ Cài đặt Supabase
              </button>
            )}
            <button className="btn btn-ghost" onClick={onClose}>
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
