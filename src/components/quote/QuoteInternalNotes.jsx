import React from 'react';

export default function QuoteInternalNotes({ form, setField }) {
  return (
    <>
      <div className="form-group" style={{ marginTop: 16 }}>
        <label>Ghi chú / Điều khoản báo giá</label>
        <textarea
          className="form-control"
          rows={4}
          value={form.notes || ""}
          onChange={e => setField("notes", e.target.value)}
        />
      </div>

      <div className="form-group" style={{ marginTop: 16, background: "var(--warning-bg)", border: "1px dashed var(--warning-text)", borderRadius: 8, padding: "12px 14px" }}>
        <label style={{ color: "var(--warning-text)", display: "flex", alignItems: "center", gap: 6 }}>
          🔒 Ghi chú nội bộ
          <span style={{ fontSize: 11, fontWeight: 400, color: "var(--warning-text)" }}>
            — chỉ hiển thị trong app, không xuất ra PDF / Word / hợp đồng
          </span>
        </label>
        <textarea
          className="form-control"
          rows={3}
          style={{ background: "var(--bg-card)", borderColor: "var(--border-color)" }}
          placeholder="Giá vốn, ghi nhớ đàm phán, thông tin nhà cung cấp, lưu ý nội bộ..."
          value={form.internalNote || ""}
          onChange={e => setField("internalNote", e.target.value)}
        />
      </div>
    </>
  );
}
