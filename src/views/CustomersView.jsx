import React, { useState, useEffect, useMemo } from 'react';
import { 
  loadCustomerCatalog, saveCustomerCatalog, upsertCatalogCustomer, 
  deleteCatalogCustomer, _mem, showToast 
} from '../utils/gasStore';
import { generateId, generateCustomerShortName, removeAccents, getCustomerColor } from '../utils/helpers';

export default function CustomersView({ quotes = [], onCreateQuoteForCustomer }) {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("quotes_desc"); // 'quotes_desc' | 'quotes_asc' | 'name_asc' | 'name_desc' | 'short_asc'
  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [form, setForm] = useState({
    id: "",
    customer: "",
    shortName: "",
    taxId: "",
    phone: "",
    contact: "",
    address: "",
    email: "",
    notes: ""
  });
  const [errorMsg, setErrorMsg] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = () => {
    loadCustomerCatalog().then(list => {
      setCustomers(list || []);
    });
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 2000);
    return () => clearInterval(interval);
  }, []);

  // Compute quote count per customer
  const customerStats = useMemo(() => {
    const map = new Map();
    (quotes || []).forEach(q => {
      if (!q || !q.customer) return;
      const name = q.customer.trim();
      const current = map.get(name) || { count: 0, latestQuote: null };
      current.count += 1;
      if (!current.latestQuote || new Date(q.date || 0) > new Date(current.latestQuote.date || 0)) {
        current.latestQuote = q;
      }
      map.set(name, current);
    });
    return map;
  }, [quotes]);

  const filteredAndSortedCustomers = useMemo(() => {
    let list = customers;
    if (search.trim()) {
      const s = removeAccents(search.trim()).toLowerCase();
      list = list.filter(c => {
        const name = removeAccents(c.customer || "").toLowerCase();
        const short = removeAccents(c.shortName || "").toLowerCase();
        const tax = (c.taxId || "").toLowerCase();
        const phone = (c.phone || "").toLowerCase();
        const contact = removeAccents(c.contact || "").toLowerCase();
        const address = removeAccents(c.address || "").toLowerCase();
        return name.includes(s) || short.includes(s) || tax.includes(s) || phone.includes(s) || contact.includes(s) || address.includes(s);
      });
    }

    return [...list].sort((a, b) => {
      const statsA = customerStats.get((a.customer || "").trim())?.count || 0;
      const statsB = customerStats.get((b.customer || "").trim())?.count || 0;

      if (sortBy === "quotes_desc") {
        if (statsB !== statsA) return statsB - statsA;
        return (a.customer || "").localeCompare(b.customer || "", "vi");
      }
      if (sortBy === "quotes_asc") {
        if (statsA !== statsB) return statsA - statsB;
        return (a.customer || "").localeCompare(b.customer || "", "vi");
      }
      if (sortBy === "name_asc") {
        return (a.customer || "").localeCompare(b.customer || "", "vi");
      }
      if (sortBy === "name_desc") {
        return (b.customer || "").localeCompare(a.customer || "", "vi");
      }
      if (sortBy === "short_asc") {
        const sA = a.shortName || generateCustomerShortName(a.customer);
        const sB = b.shortName || generateCustomerShortName(b.customer);
        return sA.localeCompare(sB, "vi");
      }
      return 0;
    });
  }, [customers, search, customerStats, sortBy]);

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setForm({
      id: generateId(),
      customer: "",
      shortName: "",
      taxId: "",
      phone: "",
      contact: "",
      address: "",
      email: "",
      notes: ""
    });
    setErrorMsg("");
    setShowModal(true);
  };

  const handleOpenEdit = (cust) => {
    setEditingCustomer(cust);
    setForm({
      id: cust.id || generateId(),
      customer: cust.customer || "",
      shortName: cust.shortName || "",
      taxId: cust.taxId || "",
      phone: cust.phone || "",
      contact: cust.contact || "",
      address: cust.address || "",
      email: cust.email || "",
      notes: cust.notes || ""
    });
    setErrorMsg("");
    setShowModal(true);
  };

  const handleAutoSuggestShort = (custName) => {
    const suggested = generateCustomerShortName(custName);
    if (suggested) {
      setForm(prev => ({ ...prev, shortName: suggested }));
    }
  };

  const handleCustomerNameChange = (val) => {
    setForm(prev => {
      const updated = { ...prev, customer: val };
      if (!prev.shortName || (editingCustomer && prev.shortName === editingCustomer.shortName)) {
        updated.shortName = generateCustomerShortName(val);
      }
      return updated;
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.customer.trim()) {
      setErrorMsg("Vui lòng nhập Tên khách hàng / Đơn vị!");
      return;
    }
    const cleanShort = form.shortName.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "");
    if (!cleanShort) {
      setErrorMsg("Vui lòng nhập Tên viết tắt (companyname) - Đây là thông tin bắt buộc!");
      return;
    }

    setSaving(true);
    try {
      await upsertCatalogCustomer({
        ...form,
        shortName: cleanShort
      });
      showToast(editingCustomer ? "✓ Đã cập nhật thông tin khách hàng!" : "✓ Đã thêm khách hàng mới thành công!", 2500);
      setShowModal(false);
      loadData();
    } catch (err) {
      setErrorMsg("Lỗi lưu dữ liệu: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (cust) => {
    const confirmText = `Bạn có chắc muốn xóa khách hàng "${cust.customer}" (${cust.shortName || "Chưa có viết tắt"})?`;
    if (!window.confirm(confirmText)) return;
    try {
      await deleteCatalogCustomer(cust.id || cust.customer);
      showToast("🗑️ Đã xóa khách hàng!", 2000);
      loadData();
    } catch (err) {
      alert("Lỗi khi xóa: " + err.message);
    }
  };

  const handleScanFromQuotes = async () => {
    if (!quotes || quotes.length === 0) {
      showToast("Không có báo giá nào để quét!", 2500);
      return;
    }
    setSaving(true);
    showToast("⏳ Đang quét báo giá và đồng bộ lên Database...", 2000);
    try {
      const existingMap = new Map();
      (customers || []).forEach(c => {
        if (c && c.customer && c.customer.trim()) {
          existingMap.set(c.customer.trim(), { ...c });
        }
      });

      let addedCount = 0;
      for (const q of quotes) {
        if (q && q.customer && q.customer.trim()) {
          const name = q.customer.trim();
          if (!existingMap.has(name)) {
            const shortName = (q.customerShort || generateCustomerShortName(name)).trim().toUpperCase();
            existingMap.set(name, {
              id: "c_" + Date.now() + "_" + Math.random().toString(36).substr(2, 4),
              customer: name,
              shortName: shortName,
              contact: q.contact || "",
              address: q.address || "",
              taxId: q.taxId || "",
              phone: q.phone || "",
              email: "",
              notes: "",
              updatedAt: new Date().toISOString()
            });
            addedCount++;
          }
        }
      }

      const mergedList = Array.from(existingMap.values());
      await saveCustomerCatalog(mergedList);
      setCustomers(mergedList);

      if (addedCount > 0) {
        showToast(`✓ Đã quét & lưu thành công ${addedCount} khách hàng mới lên Database!`, 3500);
      } else {
        showToast("Tất cả khách hàng từ danh sách báo giá đã được lưu trên Database!", 3000);
      }
    } catch (err) {
      showToast("⚠️ Lỗi khi lưu lên Database: " + err.message, 3000);
    } finally {
      setSaving(false);
      loadData();
    }
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1a2540", marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
            👥 Quản lý Khách hàng
          </h2>
          <p style={{ color: "#888", fontSize: 13 }}>
            Danh sách khách hàng, thông tin xuất hóa đơn và mã viết tắt (companyname) dùng để lưu file
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-ghost btn-sm" onClick={handleScanFromQuotes} title="Quét toàn bộ báo giá để tự động tạo danh sách khách hàng">
            📥 Quét từ Báo giá ({quotes.length})
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleOpenAdd}>
            + Thêm khách hàng mới
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 }}>
        <div className="card" style={{ padding: "12px 16px", background: "#f8fafc" }}>
          <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600 }}>Tổng số khách hàng</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#1e293b", marginTop: 4 }}>{customers.length}</div>
        </div>
        <div className="card" style={{ padding: "12px 16px", background: "#f0fdf4" }}>
          <div style={{ fontSize: 12, color: "#166534", fontWeight: 600 }}>Đã phát sinh báo giá</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#15803d", marginTop: 4 }}>
            {Array.from(customerStats.keys()).length}
          </div>
        </div>
        <div className="card" style={{ padding: "12px 16px", background: "#eff6ff" }}>
          <div style={{ fontSize: 12, color: "#1e40af", fontWeight: 600 }}>Đã tạo Tên viết tắt (chuẩn file)</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#2563eb", marginTop: 4 }}>
            {customers.filter(c => c.shortName && c.shortName.trim()).length}
          </div>
        </div>
      </div>

      {/* Filter & Search & Sort */}
      <div className="filter-bar" style={{ marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input 
          className="search-input" 
          style={{ flex: 1, minWidth: 260 }}
          placeholder="🔍 Tìm theo Tên công ty, Tên viết tắt (companyname), MST, Số ĐT, Người liên hệ..." 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
        />
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: "#64748b", whiteSpace: "nowrap" }}>Sắp xếp:</label>
          <select 
            className="form-control" 
            style={{ width: "auto", fontSize: 12, height: 36, padding: "4px 8px" }}
            value={sortBy} 
            onChange={e => setSortBy(e.target.value)}
          >
            <option value="quotes_desc">📊 Tổng số báo giá: Nhiều nhất → Ít nhất</option>
            <option value="quotes_asc">📊 Tổng số báo giá: Ít nhất → Nhiều nhất</option>
            <option value="name_asc">🔤 Tên khách hàng: A → Z</option>
            <option value="name_desc">🔤 Tên khách hàng: Z → A</option>
            <option value="short_asc">🏷️ Tên viết tắt: A → Z</option>
          </select>
        </div>
      </div>

      {/* Customer List Table */}
      {filteredAndSortedCustomers.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize: 40 }}>👥</div>
          <h3>{search ? "Không tìm thấy khách hàng phù hợp" : "Chưa có khách hàng nào"}</h3>
          <p style={{ fontSize: 13 }}>
            {search ? "Thử tìm kiếm với từ khóa khác" : "Bấm nút \"+ Thêm khách hàng mới\" hoặc \"Quét từ Báo giá\" để bắt đầu"}
          </p>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th 
                    style={{ width: 140, cursor: "pointer", userSelect: "none" }}
                    onClick={() => setSortBy(sortBy === "short_asc" ? "quotes_desc" : "short_asc")}
                    title="Bấm để sắp xếp theo Tên viết tắt"
                  >
                    Tên viết tắt (File) {sortBy === "short_asc" ? "▲" : ""}
                  </th>
                  <th 
                    style={{ cursor: "pointer", userSelect: "none" }}
                    onClick={() => setSortBy(sortBy === "name_asc" ? "name_desc" : "name_asc")}
                    title="Bấm để sắp xếp theo Tên khách hàng"
                  >
                    Tên khách hàng / Đơn vị {sortBy === "name_asc" ? "▲" : sortBy === "name_desc" ? "▼" : ""}
                  </th>
                  <th style={{ width: 130 }}>Mã số thuế</th>
                  <th style={{ width: 150 }}>Người liên hệ</th>
                  <th style={{ width: 140 }}>Số điện thoại</th>
                  <th>Địa chỉ</th>
                  <th 
                    style={{ textAlign: "center", width: 110, cursor: "pointer", userSelect: "none", background: sortBy.startsWith("quotes") ? "#f1f5f9" : "transparent" }}
                    onClick={() => setSortBy(sortBy === "quotes_desc" ? "quotes_asc" : "quotes_desc")}
                    title="Bấm để đảo chiều sắp xếp theo Tổng số báo giá"
                  >
                    Số báo giá {sortBy === "quotes_desc" ? "▼" : sortBy === "quotes_asc" ? "▲" : "⇅"}
                  </th>
                  <th style={{ textAlign: "center", width: 160 }}>Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedCustomers.map(cust => {
                  const stats = customerStats.get((cust.customer || "").trim()) || { count: 0 };
                  const col = getCustomerColor(cust.customer || "");
                  const shortName = cust.shortName || generateCustomerShortName(cust.customer);

                  return (
                    <tr key={cust.id || cust.customer}>
                      <td>
                        <span style={{ 
                          background: cust.shortName ? "#e0e7ff" : "#fee2e2", 
                          color: cust.shortName ? "#3730a3" : "#991b1b", 
                          padding: "3px 8px", 
                          borderRadius: 6, 
                          fontWeight: 700, 
                          fontSize: 11,
                          letterSpacing: "0.03em",
                          display: "inline-block"
                        }}>
                          {shortName || "CHƯA CÓ"}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: "#1a2540" }}>
                          {cust.customer}
                        </div>
                        {cust.email && (
                          <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                            ✉️ {cust.email}
                          </div>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: cust.taxId ? "#1e293b" : "#94a3b8", fontWeight: cust.taxId ? 600 : 400 }}>
                          {cust.taxId || "—"}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: cust.contact ? "#1e293b" : "#94a3b8" }}>
                          {cust.contact || "—"}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontSize: 12, color: cust.phone ? "#1e293b" : "#94a3b8" }}>
                          {cust.phone || "—"}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: 11.5, color: "#475569", maxWidth: 260, whiteSpace: "normal", wordBreak: "break-word" }}>
                          {cust.address || "—"}
                        </div>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className="badge" style={{ background: stats.count > 0 ? "#dcfce7" : "#f1f5f9", color: stats.count > 0 ? "#166534" : "#64748b", fontWeight: 700 }}>
                          {stats.count}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                          {onCreateQuoteForCustomer && (
                            <button 
                              className="btn btn-primary btn-xs" 
                              title="Tạo báo giá mới cho khách hàng này"
                              onClick={() => onCreateQuoteForCustomer(cust)}
                            >
                              + BG
                            </button>
                          )}
                          <button 
                            className="btn btn-ghost btn-xs" 
                            title="Chỉnh sửa thông tin"
                            onClick={() => handleOpenEdit(cust)}
                          >
                            ✏️
                          </button>
                          <button 
                            className="btn btn-ghost btn-xs" 
                            style={{ color: "#dc2626" }}
                            title="Xóa khách hàng"
                            onClick={() => handleDelete(cust)}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add / Edit Modal - ONLY closes on clicking X or Hủy */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="modal-title">
                {editingCustomer ? "✏️ Chỉnh sửa Khách hàng" : "➕ Thêm Khách hàng Mới"}
              </span>
              <button 
                type="button" 
                className="close-btn" 
                onClick={() => setShowModal(false)}
                title="Đóng cửa sổ"
                style={{ fontSize: 20, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSave}>
              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                
                {errorMsg && (
                  <div style={{ padding: "8px 12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, color: "#dc2626", fontSize: 12 }}>
                    ⚠️ {errorMsg}
                  </div>
                )}

                <div className="form-group">
                  <label style={{ fontWeight: 700, fontSize: 12 }}>Tên khách hàng / Đơn vị *</label>
                  <input 
                    className="form-control" 
                    placeholder="VD: CÔNG TY TNHH THƯƠNG MẠI HÒA PHÁT" 
                    value={form.customer} 
                    onChange={e => handleCustomerNameChange(e.target.value)}
                    autoFocus
                    required
                  />
                </div>

                <div className="form-group">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                    <label style={{ fontWeight: 700, fontSize: 12, color: "#1e40af" }}>
                      Tên viết tắt (companyname) * <span style={{ fontSize: 11, fontWeight: 400, color: "#64748b" }}>(Dùng đặt tên file PDF/Word: BGddmmyystt_companyname)</span>
                    </label>
                    <button 
                      type="button" 
                      className="btn btn-ghost btn-xs" 
                      onClick={() => handleAutoSuggestShort(form.customer)}
                      style={{ fontSize: 10, color: "#2563eb", padding: "1px 6px" }}
                    >
                      ⚡ Tự động gợi ý
                    </button>
                  </div>
                  <input 
                    className="form-control" 
                    placeholder="VD: HOAPHAT, VANDAT, PMC..." 
                    value={form.shortName} 
                    onChange={e => setForm({ ...form, shortName: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, "") })}
                    style={{ fontWeight: 700, letterSpacing: "0.05em", color: "#1e3a8a", textTransform: "uppercase" }}
                    required
                  />
                  <div style={{ fontSize: 11, color: "#64748b", marginTop: 3 }}>
                    Ví dụ file PDF xuất ra: <code>BG09092601_{form.shortName || "COMPANY"}.pdf</code>
                  </div>
                </div>

                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label>Mã số thuế (MST)</label>
                    <input 
                      className="form-control" 
                      placeholder="VD: 0312345678" 
                      value={form.taxId} 
                      onChange={e => setForm({ ...form, taxId: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Số điện thoại</label>
                    <input 
                      className="form-control" 
                      placeholder="VD: 0909 123 456" 
                      value={form.phone} 
                      onChange={e => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-row form-row-2">
                  <div className="form-group">
                    <label>Người liên hệ</label>
                    <input 
                      className="form-control" 
                      placeholder="VD: Anh Nam (Phòng Mua hàng)" 
                      value={form.contact} 
                      onChange={e => setForm({ ...form, contact: e.target.value })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Email</label>
                    <input 
                      className="form-control" 
                      type="email"
                      placeholder="VD: contact@hoaphat.com" 
                      value={form.email} 
                      onChange={e => setForm({ ...form, email: e.target.value })}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Địa chỉ</label>
                  <input 
                    className="form-control" 
                    placeholder="VD: 123 Đường Nguyễn Trãi, Quận 1, TP.HCM" 
                    value={form.address} 
                    onChange={e => setForm({ ...form, address: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label>Ghi chú</label>
                  <textarea 
                    className="form-control" 
                    rows={2} 
                    placeholder="Ghi chú thêm về điều khoản, chiết khấu, người phụ trách..." 
                    value={form.notes} 
                    onChange={e => setForm({ ...form, notes: e.target.value })}
                  />
                </div>

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowModal(false)}>Hủy</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? "⏳ Đang lưu..." : (editingCustomer ? "💾 Cập nhật" : "➕ Thêm mới")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
