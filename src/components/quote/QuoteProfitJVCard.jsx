import React from 'react';
import { fmt, generateId } from '../../utils/helpers';

export default function QuoteProfitJVCard({
  form,
  setField,
  subtotal,
  costSubtotal,
  profitBeforeTax,
  vat,
  vatInput,
  vatDiff,
  tndnTax,
  netProfit,
  netProfitAfterHidden,
  totalCapital,
  totalCapitalA,
  totalCapitalB,
  pctA,
  pctB,
  shareA,
  shareB,
  displayCostPaid,
  jvAmountToReturn,
  formatNumberInput,
  parseNumberInput
}) {
  return (
    <div className="card" style={{ marginTop: 16, background: "var(--bg-app)", border: "1px solid var(--border-color)", padding: "16px 20px" }}>
      <label style={{ fontWeight: 700, color: "var(--primary)", display: "flex", alignItems: "center", gap: 6, marginBottom: 12 }}>
        🔒 Tính toán Lợi nhuận & Liên doanh (Nội bộ)
      </label>

      <div className="form-row form-row-2" style={{ marginBottom: 12 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Thuế suất TNDN (%)</label>
          <input
            type="number"
            className="form-control"
            value={form.tndnRate !== undefined ? form.tndnRate : 20}
            onChange={e => setField("tndnRate", parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0, display: "flex", alignItems: "center", height: "100%" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginTop: 20 }}>
            <input
              type="checkbox"
              checked={form.isJointVenture || false}
              onChange={e => setField("isJointVenture", e.target.checked)}
              style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
            />
            <span style={{ fontWeight: 600, color: "var(--primary)" }}>Đơn hàng liên doanh với đối tác</span>
          </label>
        </div>
      </div>

      {form.isJointVenture && (
        <div style={{ marginBottom: 16, background: "#fff", padding: 14, borderRadius: 8, border: "1px solid var(--border-color)" }}>
          <div className="form-row form-row-3" style={{ marginBottom: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Tên đối tác (Bên B)</label>
              <input
                type="text"
                className="form-control"
                placeholder="Nhập tên đối tác..."
                value={form.partnerName || ""}
                onChange={e => setField("partnerName", e.target.value)}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Bên nhập hàng (chịu giá vốn)</label>
              <select
                className="form-control"
                value={form.jvPurchasingParty || "A"}
                onChange={e => setField("jvPurchasingParty", e.target.value)}
              >
                <option value="A">Bên A (PMC) nhập hàng</option>
                <option value="B">Bên B (Đối tác) nhập hàng</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Tiền NCC do PMC trả hộ (gồm VAT)</label>
              <input
                type="text"
                className="form-control"
                value={formatNumberInput(displayCostPaid)}
                onChange={e => setField("jvCostPaidByPMC", parseNumberInput(e.target.value))}
                placeholder="Tự động tính..."
              />
            </div>
          </div>

          <div className="form-row form-row-2" style={{ marginBottom: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Vốn góp thêm Bên A (PMC) (đ)</label>
              <input
                type="text"
                className="form-control"
                value={formatNumberInput(form.capitalA || 0)}
                onChange={e => setField("capitalA", parseNumberInput(e.target.value))}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Vốn góp thêm Bên B (Đối tác) (đ)</label>
              <input
                type="text"
                className="form-control"
                value={formatNumberInput(form.capitalB || 0)}
                onChange={e => setField("capitalB", parseNumberInput(e.target.value))}
              />
            </div>
          </div>

          <div style={{ borderTop: "1px dashed var(--border-color)", paddingTop: 12, marginBottom: 12 }}>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)", display: "block", marginBottom: 8 }}>
              Danh sách chi phí ẩn (không tính thuế)
            </label>
            {(form.jvHiddenCosts || []).map((hc, hidx) => (
              <div key={hc.id || hidx} style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8 }}>
                <input
                  type="text"
                  className="form-control"
                  placeholder="Ghi chú chi phí (VD: Vận chuyển, Cọ vẽ...)"
                  style={{ flex: 2 }}
                  value={hc.name || ""}
                  onChange={e => {
                    const newCosts = [...(form.jvHiddenCosts || [])];
                    newCosts[hidx].name = e.target.value;
                    setField("jvHiddenCosts", newCosts);
                  }}
                />
                <input
                  type="text"
                  className="form-control"
                  placeholder="Số tiền (đ)..."
                  style={{ flex: 1 }}
                  value={formatNumberInput(hc.amount || 0)}
                  onChange={e => {
                    const newCosts = [...(form.jvHiddenCosts || [])];
                    newCosts[hidx].amount = parseNumberInput(e.target.value);
                    setField("jvHiddenCosts", newCosts);
                  }}
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ color: "var(--danger-text)", padding: "6px 12px", border: "1px solid var(--border-color)", background: "var(--danger-bg)" }}
                  onClick={() => {
                    const newCosts = (form.jvHiddenCosts || []).filter((_, i) => i !== hidx);
                    setField("jvHiddenCosts", newCosts);
                  }}
                >
                  🗑️
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ marginTop: 4 }}
              onClick={() => {
                const newCosts = [...(form.jvHiddenCosts || []), { id: generateId(), name: "", amount: 0 }];
                setField("jvHiddenCosts", newCosts);
              }}
            >
              ➕ Thêm chi phí ẩn
            </button>
          </div>

          <div className="form-row form-row-2" style={{ borderTop: "1px dashed var(--border-color)", paddingTop: 12 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Cách chia lợi nhuận</label>
              <select
                className="form-control"
                value={form.jvSplitMethod || "pct"}
                onChange={e => setField("jvSplitMethod", e.target.value)}
              >
                <option value="pct">Bên B chi lại theo Tỷ lệ % lợi nhuận ròng</option>
                <option value="amount">Bên B chi lại theo Số tiền cố định</option>
              </select>
            </div>
            {form.jvSplitMethod === "amount" ? (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Số tiền Bên B chi lại cho PMC (Bên A) (đ)</label>
                <input
                  type="text"
                  className="form-control"
                  value={formatNumberInput(form.jvShareAmount || 0)}
                  onChange={e => setField("jvShareAmount", parseNumberInput(e.target.value))}
                />
              </div>
            ) : (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Tỷ lệ Bên B chi lại cho PMC (Bên A) (%)</label>
                <input
                  type="number"
                  className="form-control"
                  value={form.jvSharePct !== undefined ? form.jvSharePct : 50}
                  onChange={e => setField("jvSharePct", parseFloat(e.target.value) || 0)}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Calculations breakdown details */}
      <div style={{ background: "#fff", border: "1px solid var(--border-color)", borderRadius: 8, padding: 14, fontSize: 13 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "8px 16px" }}>
          <div>Doanh thu chưa thuế (A):</div>
          <div style={{ fontWeight: 600 }}>{fmt(subtotal)} đ</div>

          <div>Giá vốn chưa thuế (B):</div>
          <div style={{ fontWeight: 600 }}>{fmt(costSubtotal)} đ</div>

          <div>Lợi nhuận trước thuế (C = A - B):</div>
          <div style={{ fontWeight: 600, color: profitBeforeTax >= 0 ? "var(--success-text)" : "var(--danger-text)" }}>
            {fmt(profitBeforeTax)} đ
          </div>

          <div>Chênh lệch VAT (D = VAT đầu ra - VAT đầu vào):</div>
          <div style={{ fontWeight: 600 }}>
            {fmt(vatDiff)} đ <span style={{ fontWeight: 400, fontSize: 11, color: "var(--text-muted)" }}>(Đầu ra {fmt(vat)} - Đầu vào {fmt(vatInput)})</span>
          </div>

          <div>Thuế TNDN (E = C * {form.tndnRate}%):</div>
          <div style={{ fontWeight: 600 }}>{fmt(tndnTax)} đ</div>

          <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 8, fontWeight: 600, fontSize: 13, color: "var(--text-muted)" }}>
            Lợi nhuận ròng trước chi phí ẩn (Net):
          </div>
          <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 8, fontWeight: 600, fontSize: 13, color: "var(--text-muted)" }}>
            {fmt(netProfit)} đ
          </div>

          {form.jvHiddenCost > 0 && (
            <>
              <div>Chi phí ẩn (nội bộ cũ):</div>
              <div style={{ fontWeight: 600, color: "var(--danger-text)" }}>-{fmt(form.jvHiddenCost)} đ</div>
            </>
          )}

          {(form.jvHiddenCosts || []).map((hc, hidx) => hc.amount > 0 && (
            <React.Fragment key={hc.id || hidx}>
              <div style={{ paddingLeft: 12, color: "var(--text-muted)", fontSize: 12.5 }}>
                &bull; {hc.name || "Chi phí phát sinh"}:
              </div>
              <div style={{ fontWeight: 600, color: "var(--danger-text)", fontSize: 12.5 }}>
                -{fmt(hc.amount)} đ
              </div>
            </React.Fragment>
          ))}

          <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 8, fontWeight: 700, fontSize: 14, color: "var(--accent)" }}>
            LỢI NHUẬN RÒNG CUỐI CÙNG:
          </div>
          <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 8, fontWeight: 700, fontSize: 14, color: "var(--accent)" }}>
            {fmt(netProfitAfterHidden)} đ
          </div>
        </div>

        {form.isJointVenture && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px dashed var(--border-color)", display: "grid", gridTemplateColumns: "1fr auto", gap: "8px 16px", alignItems: "center" }}>
            <div style={{ fontWeight: 600, color: "var(--primary)" }}>Tổng vốn góp đầu tư:</div>
            <div style={{ fontWeight: 700, fontSize: 14 }}>{fmt(totalCapital)} đ</div>

            {totalCapital > 0 && (
              <>
                <div>
                  PMC (Bên A) góp vốn ({pctA.toFixed(1)}%):
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                    (Vốn hàng: {form.jvPurchasingParty === "B" ? 0 : fmt(costSubtotal)} đ + Góp thêm: {fmt(form.capitalA || 0)} đ)
                  </div>
                </div>
                <div style={{ textAlign: "right", fontWeight: 500 }}>
                  {fmt(totalCapitalA)} đ
                </div>

                <div>
                  {form.partnerName || "Đối tác"} (Bên B) góp vốn ({pctB.toFixed(1)}%):
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                    (Vốn hàng: {form.jvPurchasingParty === "B" ? fmt(costSubtotal) : 0} đ + Góp thêm: {fmt(form.capitalB || 0)} đ)
                  </div>
                </div>
                <div style={{ textAlign: "right", fontWeight: 500 }}>
                  {fmt(totalCapitalB)} đ
                </div>
              </>
            )}

            <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 8, fontWeight: 700, color: "var(--accent)" }}>
              Lợi nhuận chia PMC (Bên A) {form.jvSplitMethod === "amount" ? "(Cố định)" : `(${form.jvSharePct || 50}%)`}:
            </div>
            <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 8, fontWeight: 700, color: "var(--accent)", textAlign: "right" }}>
              {fmt(shareA)} đ
            </div>

            <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 8, fontWeight: 600, color: "var(--text-muted)" }}>
              Lợi nhuận chia {form.partnerName || "Đối tác"} (Bên B) {form.jvSplitMethod === "amount" ? "(Phần còn lại)" : `(${100 - (form.jvSharePct || 50)}%)`}:
            </div>
            <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: 8, fontWeight: 600, color: "var(--text-muted)", textAlign: "right" }}>
              {fmt(shareB)} đ
            </div>

            <div style={{ borderTop: "2px double var(--border-color)", paddingTop: 10, fontWeight: 800, fontSize: 14, color: "#dc2626" }}>
              SỐ TIỀN THỰC TẾ TRẢ LẠI BÊN B:
              <div style={{ fontSize: 11, fontWeight: 400, color: "var(--text-muted)", marginTop: 2 }}>
                (Doanh thu: {fmt(subtotal + vat)} đ - Trả NCC: {fmt(displayCostPaid)} đ - Chênh lệch VAT: {fmt(vatDiff)} đ - Thuế TNDN: {fmt(tndnTax)} đ)
              </div>
            </div>
            <div style={{ borderTop: "2px double var(--border-color)", paddingTop: 10, fontWeight: 800, fontSize: 16, color: "var(--danger-text)", textAlign: "right" }}>
              {fmt(jvAmountToReturn)} đ
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
