import React, { useState, useEffect, useRef, memo } from 'react';
import { loadProductCatalog, PRODUCT_CATALOG, upsertProductImage } from '../../utils/gasStore';
import { fmt, removeAccents } from '../../utils/helpers';
import { FormattedNumberInput } from '../common/FormattedNumberInput';

function QuoteItemRow({
  it,
  idx,
  allQuotes,
  vatRate,
  lang,
  onSetItem,
  onSetItemFields,
  onRemove,
  onInsertAbove,
  onInsertBelow
}) {
  const [showSearch, setShowSearch] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const nameRef = useRef(null);
  const fileRef = useRef(null);
  const noteRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    loadProductCatalog().then(persisted => {
      if (!mounted) return;
      const byName = new Map((persisted || []).map(p => [p.name, p]));
      PRODUCT_CATALOG.forEach(n => {
        if (n && !byName.has(n)) byName.set(n, { name: n, note: "", unit: "Cái", price: 0, cost: 0, costNoVat: 0, image: "" });
      });
      (allQuotes || []).flatMap(q => q.items || []).forEach(i => {
        if (i && i.name && i.name.trim() && !byName.has(i.name.trim())) {
          byName.set(i.name.trim(), {
            name: i.name.trim(),
            note: i.note || "",
            unit: i.unit || "Cái",
            price: i.price || 0,
            cost: i.cost || 0,
            costNoVat: i.costNoVat || 0,
            image: i.image || ""
          });
        }
      });
      setCatalog([...byName.values()]);
    }).catch(() => {});
    return () => { mounted = false; };
  }, [allQuotes]);

  useEffect(() => {
    if (noteRef.current) {
      noteRef.current.style.height = "auto";
      noteRef.current.style.height = noteRef.current.scrollHeight + "px";
    }
  }, [it.note]);

  const handleNameChange = (val) => {
    onSetItem(idx, "name", val);
    const cleanVal = removeAccents(val.trim());
    if (cleanVal.length >= 1) {
      const results = catalog.filter(p => {
        const nameClean = removeAccents(p.name);
        const noteClean = removeAccents(p.note || "");
        return nameClean.includes(cleanVal) || noteClean.includes(cleanVal);
      });
      setSearchResults(results.slice(0, 30));
      setShowSearch(results.length > 0);
    } else {
      setSearchResults(catalog.slice(0, 30));
      setShowSearch(catalog.length > 0);
    }
  };

  const selectSuggestion = (product) => {
    onSetItemFields(idx, {
      name: product.name,
      note: product.note || "",
      unit: product.unit || "Cái",
      price: product.price || 0,
      cost: product.cost || 0,
      costNoVat: product.costNoVat || 0,
      image: product.image || "",
    });
    setShowSearch(false);
  };

  const handleImageUpload = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      onSetItem(idx, "image", dataUrl);
      if (it.name && it.name.trim()) {
        upsertProductImage(it.name, dataUrl, {
          note: it.note || "",
          unit: it.unit || "Cái",
          price: it.price || 0,
          cost: it.cost || 0,
          costNoVat: it.costNoVat || 0
        }).catch(() => {});
      }
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => onSetItem(idx, "image", "");

  const iVatRate = it.vatRate !== undefined ? it.vatRate : (vatRate !== undefined ? vatRate : 8);
  const r = (iVatRate === -1 ? 0 : (iVatRate || 0)) / 100;

  const setCost = (val) => {
    onSetItemFields(idx, { cost: val, costNoVat: r > 0 ? Math.round(val / (1 + r)) : val });
  };
  const setCostNoVat = (val) => {
    onSetItemFields(idx, { costNoVat: val, cost: Math.round(val * (1 + r)) });
  };

  const lineTotal = (it.qty || 0) * (it.price || 0);
  const lineTotalWithVat = iVatRate === -1 ? lineTotal : lineTotal + Math.round(lineTotal * (iVatRate || 0) / 100);

  return (
    <tr>
      <td className="stt-cell">{idx + 1}</td>
      <td style={{ width: 64 }} className="internal-col">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "4px" }}>
          {it.image ? (
            <div style={{ position: "relative" }}>
              <img
                src={it.image}
                alt=""
                style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 4, border: "1px solid #e5e3dc", cursor: "pointer" }}
                onClick={() => fileRef.current && fileRef.current.click()}
              />
              <button
                onClick={removeImage}
                title="Xóa ảnh"
                style={{ position: "absolute", top: -6, right: -6, background: "#dc2626", color: "#fff", border: "none", borderRadius: "50%", width: 16, height: 16, fontSize: 10, lineHeight: 1, cursor: "pointer" }}
              >
                ×
              </button>
            </div>
          ) : (
            <button className="btn btn-ghost btn-sm" style={{ padding: "4px 6px", fontSize: 11 }} onClick={() => fileRef.current && fileRef.current.click()}>
              + Ảnh
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleImageUpload} />
        </div>
      </td>
      <td style={{ minWidth: 260 }}>
        <div className="name-note-cell">
          <div className="item-search-wrap">
            <input
              ref={nameRef}
              className="item-name"
              value={it.name || ""}
              onChange={e => handleNameChange(e.target.value)}
              onBlur={() => setTimeout(() => setShowSearch(false), 200)}
              onFocus={() => handleNameChange(it.name || "")}
              placeholder="Tên sản phẩm / dịch vụ..."
            />
            {showSearch && (
              <div className="item-search-dropdown">
                {searchResults.map((sr, i) => (
                  <div key={i} className="item-search-option" onMouseDown={() => selectSuggestion(sr)}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {sr.image && <img src={sr.image} alt="" style={{ width: 24, height: 24, objectFit: "cover", borderRadius: 3, flexShrink: 0 }} />}
                      <div>{sr.name}</div>
                    </div>
                    {(sr.price > 0 || sr.unit) && (
                      <div style={{ fontSize: 11, color: "#999", marginTop: 2 }}>
                        {sr.unit || "Cái"}{sr.price > 0 ? ` · ${fmt(sr.price)} đ` : ""}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <textarea
            ref={noteRef}
            className="item-note"
            rows={1}
            value={it.note || ""}
            onChange={e => onSetItem(idx, "note", e.target.value)}
            placeholder="Ghi chú thêm (mã SP, quy cách, lưu ý...)"
          />
          {lang && lang !== "vi" ? (
            <div style={{ marginTop: 4 }}>
              <input
                className="item-name"
                style={{ border: "1px dashed #2563eb", background: "#eff6ff", color: "#1e40af", fontSize: 11, padding: "2px 5px", borderRadius: 3, width: "100%" }}
                value={it.nameEn || ""}
                onChange={e => onSetItem(idx, "nameEn", e.target.value)}
                placeholder={`Tên tiếng ${lang === "vi_en" ? "Anh" : "Trung"}...`}
              />
              <textarea
                className="item-note"
                style={{ border: "1px dashed #2563eb", background: "#eff6ff", color: "#1e40af", fontSize: 10, padding: "2px 5px", borderRadius: 3, marginTop: 2, width: "100%" }}
                rows={1}
                value={it.noteEn || ""}
                onChange={e => onSetItem(idx, "noteEn", e.target.value)}
                placeholder={`Ghi chú tiếng ${lang === "vi_en" ? "Anh" : "Trung"}...`}
              />
            </div>
          ) : null}
        </div>
      </td>
      <td style={{ width: 70 }}>
        <input
          className="qty-input"
          type="number"
          min="0"
          value={it.qty}
          onChange={e => onSetItem(idx, "qty", Number(e.target.value))}
          onWheel={e => e.target.blur()}
          onKeyDown={e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault(); }}
        />
      </td>
      <td style={{ width: 80 }}>
        <input className="unit-input" value={it.unit || "Cái"} onChange={e => onSetItem(idx, "unit", e.target.value)} />
      </td>
      <td style={{ width: 110 }}>
        <FormattedNumberInput className="price-input" value={it.price || 0} onChange={v => onSetItem(idx, "price", v)} />
      </td>
      <td style={{ width: 80, textAlign: "center" }}>
        <select
          value={iVatRate}
          onChange={e => onSetItem(idx, "vatRate", Number(e.target.value))}
          style={{ fontSize: 12, padding: "2px 4px", borderRadius: 4, border: "1px solid #d1cfc6", width: "100%", textAlign: "center" }}
        >
          <option value={-1}>KCT</option>
          <option value={0}>0%</option>
          <option value={5}>5%</option>
          <option value={8}>8%</option>
          <option value={10}>10%</option>
        </select>
      </td>
      <td className="total-cell" style={{ width: 110 }}>{fmt(lineTotalWithVat)}</td>
      <td style={{ width: 120 }} className="internal-col">
        <FormattedNumberInput className="price-input" value={it.costNoVat || 0} onChange={v => setCostNoVat(v)} placeholder="Giá nhập chưa VAT" />
      </td>
      <td style={{ width: 120 }} className="internal-col">
        <FormattedNumberInput className="price-input" value={it.cost || 0} onChange={v => setCost(v)} placeholder="Giá nhập đã gồm VAT" />
      </td>
      <td
        className="total-cell internal-col"
        style={{
          width: 110,
          color: (() => {
            const sellExVat = (it.price || 0);
            const costExVat = (it.costNoVat || 0);
            return (sellExVat - costExVat) * (it.qty || 0) >= 0 ? "#16a34a" : "#dc2626";
          })()
        }}
      >
        {fmt((() => {
          const sellExVat = (it.price || 0);
          const costExVat = (it.costNoVat || 0);
          return Math.round((sellExVat - costExVat) * (it.qty || 0));
        })())}
      </td>
      <td className="action-cell" style={{ width: 80, whiteSpace: "nowrap" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 3 }}>
          <button
            type="button"
            title="Thêm dòng phía trên"
            style={{ background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 4, cursor: "pointer", color: "#1e293b", padding: "2px 5px", fontSize: 11, lineHeight: 1, fontWeight: 600 }}
            onClick={() => onInsertAbove && onInsertAbove(idx)}
          >
            +⬆
          </button>
          <button
            type="button"
            title="Thêm dòng phía dưới"
            style={{ background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 4, cursor: "pointer", color: "#1e293b", padding: "2px 5px", fontSize: 11, lineHeight: 1, fontWeight: 600 }}
            onClick={() => onInsertBelow && onInsertBelow(idx)}
          >
            +⬇
          </button>
          <button
            type="button"
            title="Xóa dòng này"
            style={{ background: "#fef2f2", border: "1px solid #fca5a5", borderRadius: 4, cursor: "pointer", color: "#dc2626", padding: "2px 5px", fontSize: 13, lineHeight: 1, fontWeight: "bold" }}
            onClick={() => onRemove(idx)}
          >
            ×
          </button>
        </div>
      </td>
    </tr>
  );
}

export default memo(QuoteItemRow);
