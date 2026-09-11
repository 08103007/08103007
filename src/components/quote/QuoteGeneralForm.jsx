import React, { useState } from 'react';
import { generateCustomerShortName, lookupTaxInfo } from '../../utils/helpers';
import { showToast } from '../../utils/gasStore';

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
  const [lookingUpTax, setLookingUpTax] = useState(false);

  const handleTaxLookup = async (taxCode) => {
    const raw = (taxCode !== undefined ? taxCode : form.taxId || "").trim();
    const code = raw.replace(/[^0-9-]/g, "");
    if (!code || code.length < 10) {
      showToast("⚠️ Vui lòng nhập mã số thuế hợp lệ (10 hoặc 13 số)", 2500);
      return;
    }
    setLookingUpTax(true);
    try {
      const data = await lookupTaxInfo(code);
      if (data && data.name) {
        setField("customer", data.name);
        if (data.address) setField("address", data.address);
        if (data.taxId) setField("taxId", data.taxId);

        const short = (data.shortName && data.shortName.length <= 12)
          ? generateCustomerShortName(data.shortName)
          : generateCustomerShortName(data.name);
        if (short && (!form.customerShort || form.customerShort === generateCustomerShortName(form.customer || ""))) {
          setField("customerShort", short);
        }

        showToast(`✓ Đã tự động lấy: ${data.name}`, 3000);
      }
    } catch (err) {
      showToast("⚠️ " + (err.message || "Không tìm thấy thông tin MST"), 3000);
    } finally {
      setLookingUpTax(false);
    }
  };

  const handleTaxChange = (val) => {
    setField("taxId", val);
    const clean = val.trim().replace(/[^0-9-]/g, "");
    if ((clean.length === 10 || clean.length === 13 || clean.length === 14) && !form.customer) {
      handleTaxLookup(clean);
    }
  };

  return (
    <>
      <div className="section-title">📋 Thông tin chung</div>

      {/* Row 1: Số báo giá (Left 50%) & Ngày báo giá (Right 50%) */}
      <div className="form-row form-row-2" style={{ marginBottom: 12 }}>
        <div className="form-group">
          <label>Số báo giá</label>
          <input
            className="form-control"
            value={form.quoteNumber || ""}
            onChange={e => setField("quoteNumber", e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Ngày báo giá</label>
          <input
            type="text"
            className="form-control"
            placeholder="DD/MM/YYYY"
            value={form.date || ""}
            onChange={e => setField("date", e.target.value)}
          />
        </div>
      </div>

      {/* Row 2: Tên khách hàng / Đơn vị * (Left 50%) & Tên viết tắt (companyname) * (Right 50%) */}
      <div className="form-row form-row-2" style={{ marginBottom: 12 }}>
        <div className="form-group">
          <label>Tên khách hàng / Đơn vị *</label>
          <div className="item-search-wrap">
            <input
              className="form-control"
              placeholder="VD: CÔNG TY TNHH ABC"
              value={form.customer || ""}
              onChange={e => handleCustomerChange(e.target.value)}
              onBlur={() => setTimeout(() => setShowCustSearch(false), 200)}
              onFocus={() => handleCustomerChange(form.customer || "")}
            />
            {showCustSearch && (
              <div className="item-search-dropdown">
                {custSearchResults.map((c, i) => (
                  <div key={i} className="item-search-option" onMouseDown={() => selectCustomer(c)}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 600 }}>{c.customer}</span>
                      {(c.shortName || c.customerShort) && (
                        <span style={{ fontSize: 10, background: "#e0e7ff", color: "#3730a3", padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>
                          {c.shortName || c.customerShort}
                        </span>
                      )}
                    </div>
                    {(c.taxId || c.contact || c.address) && (
                      <div style={{ fontSize: 11, color: "var(--text-light)", marginTop: 2 }}>
                        {c.taxId ? <span style={{ fontWeight: 600, color: "#1e40af" }}>MST: {c.taxId} · </span> : null}
                        {c.contact ? <span>{c.contact} · </span> : null}
                        {c.address}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="form-group">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
            <label style={{ fontWeight: 700, color: "#1e40af" }}>
              Tên viết tắt (companyname) *
            </label>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => setField("customerShort", generateCustomerShortName(form.customer || ""))}
              style={{ fontSize: 10, color: "#2563eb", padding: "1px 5px", height: "auto" }}
              title="Tự động tạo mã viết tắt từ tên khách hàng"
            >
              ⚡ Gợi ý viết tắt
            </button>
          </div>
          <input
            className="form-control"
            placeholder="VD: HOAPHAT, VANDAT, PMC..."
            value={form.customerShort || ""}
            onChange={e => setField("customerShort", e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ""))}
            style={{ fontWeight: 700, letterSpacing: "0.04em", color: "#1e3a8a", textTransform: "uppercase" }}
          />
        </div>
      </div>

      {/* Row 3: Mã số thuế (Left 50%) & Địa chỉ (Right 50%) */}
      <div className="form-row form-row-2" style={{ marginBottom: 12 }}>
        <div className="form-group">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
            <label>Mã số thuế</label>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={() => handleTaxLookup()}
              disabled={lookingUpTax}
              style={{ fontSize: 10, color: "#2563eb", padding: "1px 6px", height: "auto" }}
              title="Tự động lấy tên công ty, địa chỉ từ mã số thuế"
            >
              {lookingUpTax ? "⏳ Đang tra..." : "🔍 Tra cứu MST"}
            </button>
          </div>
          <input
            className="form-control"
            placeholder="VD: 3502541992"
            value={form.taxId || ""}
            onChange={e => handleTaxChange(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>Địa chỉ</label>
          <input
            className="form-control"
            placeholder="Địa chỉ khách hàng"
            value={form.address || ""}
            onChange={e => setField("address", e.target.value)}
          />
        </div>
      </div>

      {/* Row 4: Người liên hệ (Left 50%) & Điện thoại (Right 50%) */}
      <div className="form-row form-row-2" style={{ marginBottom: 16 }}>
        <div className="form-group">
          <label>Người liên hệ</label>
          <input
            className="form-control"
            placeholder="Tên người liên hệ"
            value={form.contact || ""}
            onChange={e => setField("contact", e.target.value)}
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

      {/* Row 5: Nội dung công việc */}
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
