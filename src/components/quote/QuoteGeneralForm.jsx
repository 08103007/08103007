import React from 'react';
import { STATUS_LABELS } from '../../utils/helpers';

export default function QuoteGeneralForm({
  form,
  isNew,
  setField,
  handleCustomerChange,
  showCustSearch,
  setShowCustSearch,
  custSearchResults,
  selectCustomer
}) {
  return (
    <>
      <div className="section-title">📋 Thông tin chung</div>
      <div className="form-row form-row-4" style={{ marginBottom: 12 }}>
        <div className="form-group">
          <label>Số báo giá</label>
          <input
            className="form-control"
            value={form.quoteNumber || ""}
            onChange={e => setField("quoteNumber", e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Ngày</label>
          <input
            className="form-control"
            value={form.date || ""}
            onChange={e => setField("date", e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Ngôn ngữ hiển thị</label>
          <select
            className="form-control"
            value={form.lang || "vi"}
            onChange={e => setField("lang", e.target.value)}
          >
            <option value="vi">🇻🇳 Chỉ Tiếng Việt (Mặc định)</option>
            <option value="vi_en">🇻🇳 🇬🇧 Song ngữ Việt - Anh</option>
            <option value="vi_zh">🇻🇳 🇨🇳 Song ngữ Việt - Trung</option>
          </select>
        </div>
        <div className="form-group">
          <label>Trạng thái</label>
          <select
            className="form-control"
            value={form.status || "draft"}
            onChange={e => setField("status", e.target.value)}
          >
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-row form-row-2" style={{ marginBottom: 16 }}>
        <div className="form-group">
          <label>Tên khách hàng *</label>
          <div className="item-search-wrap">
            <input
              className="form-control"
              placeholder="VD: CÔNG TY TNHH ABC"
              value={form.customer || ""}
              onChange={e => handleCustomerChange(e.target.value)}
              onBlur={() => setTimeout(() => setShowCustSearch(false), 150)}
              onFocus={() => form.customer && handleCustomerChange(form.customer)}
            />
            {showCustSearch && (
              <div className="item-search-dropdown">
                {custSearchResults.map((c, i) => (
                  <div key={i} className="item-search-option" onMouseDown={() => selectCustomer(c)}>
                    <div>{c.customer}</div>
                    {(c.contact || c.address) && (
                      <div style={{ fontSize: 11, color: "var(--text-light)", marginTop: 2 }}>
                        {c.contact}{c.contact && c.address ? " · " : ""}{c.address}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="form-group">
          <label>Người liên hệ</label>
          <input
            className="form-control"
            placeholder="Tên người liên hệ"
            value={form.contact || ""}
            onChange={e => setField("contact", e.target.value)}
          />
        </div>
      </div>

      <div className="form-row form-row-3" style={{ marginBottom: 16 }}>
        <div className="form-group">
          <label>Địa chỉ</label>
          <input
            className="form-control"
            placeholder="Địa chỉ khách hàng"
            value={form.address || ""}
            onChange={e => setField("address", e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Mã số thuế</label>
          <input
            className="form-control"
            placeholder="MST"
            value={form.taxId || ""}
            onChange={e => setField("taxId", e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Điện thoại</label>
          <input
            className="form-control"
            placeholder="SĐT"
            value={form.phone || ""}
            onChange={e => setField("phone", e.target.value)}
          />
        </div>
      </div>

      <div className="form-group" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <label style={{ marginBottom: 0 }}>Nội dung công việc</label>
        </div>
        <textarea
          className="form-control"
          rows={2}
          placeholder="VD: Cung cấp và lắp đặt thiết bị mạng tại văn phòng..."
          value={form.workContent || ""}
          onChange={e => setField("workContent", e.target.value)}
        />
        {form.lang && form.lang !== "vi" ? (
          <div style={{ marginTop: 6 }}>
            <label style={{ fontSize: 11, color: "#666" }}>Dịch nội dung ({form.lang === "vi_en" ? "English" : "中文"})</label>
            <textarea
              className="form-control"
              rows={2}
              placeholder="Nội dung dịch..."
              value={form.workContentEn || ""}
              onChange={e => setField("workContentEn", e.target.value)}
            />
          </div>
        ) : null}
      </div>
    </>
  );
}
