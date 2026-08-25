import React from 'react';
import QuoteItemRow from './QuoteItemRow';
import { fmt } from '../../utils/helpers';

export default function QuoteItemsTable({
  items,
  allQuotes,
  vatRate,
  lang,
  onSetItem,
  onSetItemFields,
  onRemoveItem,
  onInsertItem,
  onAddItem,
  onOpenXmlImport,
  subtotal,
  vat,
  total,
  profitBeforeTax,
  netProfit
}) {
  return (
    <>
      <div className="section-title">📦 Hàng hóa / Dịch vụ</div>
      <div style={{ fontSize: 11, color: "#888", marginBottom: 6 }}>
        💡 Nhập tên hàng hóa để gợi ý tự động. Dòng ghi chú nhỏ bên dưới mỗi sản phẩm (mã SP, quy cách...)
      </div>
      <div className="table-wrap">
        <table className="items-table">
          <thead>
            <tr>
              <th style={{ width: 30 }}>STT</th>
              <th style={{ width: 64 }} className="internal-col">Ảnh</th>
              <th>Tên hàng hóa / dịch vụ & Ghi chú</th>
              <th style={{ width: 70 }}>SL</th>
              <th style={{ width: 80 }}>ĐVT</th>
              <th style={{ width: 110 }}>Đơn giá</th>
              <th style={{ width: 80 }}>VAT %</th>
              <th style={{ width: 110 }}>Thành tiền</th>
              <th style={{ width: 120 }} className="internal-col">Giá nhập chưa VAT</th>
              <th style={{ width: 120 }} className="internal-col">Giá nhập gồm VAT</th>
              <th style={{ width: 110 }} className="internal-col">Lợi nhuận</th>
              <th style={{ width: 80, textAlign: "center" }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it, idx) => (
              <QuoteItemRow
                key={it.id || idx}
                it={it}
                idx={idx}
                allQuotes={allQuotes}
                vatRate={vatRate}
                lang={lang}
                onSetItem={onSetItem}
                onSetItemFields={onSetItemFields}
                onRemove={onRemoveItem}
                onInsertAbove={i => onInsertItem(i, "above")}
                onInsertBelow={i => onInsertItem(i, "below")}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <button className="btn btn-ghost btn-sm" onClick={onAddItem}>
          + Thêm dòng
        </button>
        <button className="btn btn-sm xml-import-btn" onClick={onOpenXmlImport}>
          📄 Nhập từ XML hóa đơn
        </button>
      </div>

      <div className="total-summary">
        <div className="total-row">
          <span>Tiền hàng (chưa VAT)</span>
          <span>{fmt(subtotal)} đ</span>
        </div>
        <div className="total-row">
          <span>VAT (tính theo từng mặt hàng)</span>
          <span>{fmt(vat)} đ</span>
        </div>
        <div className="total-row grand">
          <span>TỔNG CỘNG (gồm VAT)</span>
          <span>{fmt(total)} đ</span>
        </div>
        <div className="total-row internal-col" style={{ marginTop: 6, paddingTop: 10, borderTop: "1px dashed var(--border-color)" }}>
          <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>Lợi nhuận gộp trước thuế (nội bộ)</span>
          <span style={{ color: profitBeforeTax >= 0 ? "var(--success-text)" : "var(--danger-text)", fontWeight: 600 }}>
            {fmt(profitBeforeTax)} đ
          </span>
        </div>
        <div className="total-row internal-col">
          <span style={{ color: "var(--accent)", fontWeight: 600 }}>Lợi nhuận ròng thực tế (nội bộ)</span>
          <span style={{ color: netProfit >= 0 ? "var(--success-text)" : "var(--danger-text)", fontWeight: 700 }}>
            {fmt(netProfit)} đ
          </span>
        </div>
      </div>
    </>
  );
}
