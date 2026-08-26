import React, { useState, useEffect, useCallback } from 'react';
import { loadCustomerCatalog, upsertCatalogItems, upsertCatalogCustomer, showToast } from '../../utils/gasStore';
import { generateId, generateQuoteNumber, todayStr, calcItems, removeAccents } from '../../utils/helpers';
import QuoteGeneralForm from './QuoteGeneralForm';
import QuoteItemsTable from './QuoteItemsTable';
import QuoteProfitJVCard from './QuoteProfitJVCard';
import QuoteInternalNotes from './QuoteInternalNotes';
import XmlImportModal from '../XmlImportModal';
import QuoteVersionHistoryModal from './QuoteVersionHistoryModal';

export default function QuoteModal({ quote, allQuotes, onSave, onClose }) {
  const isNew = !quote;
  const [form, setForm] = useState(() => {
    const defaultData = {
      id: generateId(),
      quoteNumber: generateQuoteNumber(allQuotes),
      date: todayStr(),
      customer: "",
      contact: "",
      address: "",
      taxId: "",
      phone: "",
      workContent: "",
      internalNote: "",
      status: "draft",
      vatRate: 8,
      items: [{ id: generateId(), name: "", note: "", qty: 1, unit: "Cái", price: 0, cost: 0, costNoVat: 0, image: "", vatRate: 8 }],
      notes: `Triển khai dịch vụ và giao hàng tận nơi.
Báo giá có hiệu lực 05 ngày kể từ ngày gửi.
Giá thiết bị, linh kiện có thể thay đổi theo thời giá.
Thông tin chi tiết quý khách vui lòng liên hệ trực tiếp.`,
      isJointVenture: false,
      capitalA: 0,
      capitalB: 0,
      partnerName: "",
      tndnRate: 20,
      jvPurchasingParty: "A",
      jvSplitMethod: "pct",
      jvSharePct: 50,
      jvShareAmount: 0,
      jvCostPaidByPMC: null,
      jvHiddenCost: 0,
      jvHiddenCosts: [],
      versions: []
    };
    if (quote) {
      const qCopy = JSON.parse(JSON.stringify(quote));
      return { ...defaultData, ...qCopy };
    }
    return defaultData;
  });

  const [custCatalog, setCustCatalog] = useState([]);
  const [showCustSearch, setShowCustSearch] = useState(false);
  const [custSearchResults, setCustSearchResults] = useState([]);
  const [saving, setSaving] = useState(false);
  const [showXmlImport, setShowXmlImport] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  useEffect(() => {
    loadCustomerCatalog().then(persisted => {
      const byName = new Map();
      (persisted || []).forEach(c => {
        if (c && c.customer && c.customer.trim()) byName.set(c.customer.trim(), c);
      });
      (allQuotes || []).forEach(q => {
        if (q && q.customer && q.customer.trim() && !byName.has(q.customer.trim())) {
          byName.set(q.customer.trim(), {
            customer: q.customer.trim(),
            contact: q.contact || "",
            address: q.address || "",
            taxId: q.taxId || "",
            phone: q.phone || ""
          });
        }
      });
      setCustCatalog([...byName.values()]);
    }).catch(() => {});
  }, [allQuotes]);

  const setField = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const handleCustomerChange = (val) => {
    setField("customer", val);
    const cleanVal = removeAccents(val.trim());
    if (cleanVal.length >= 1) {
      const results = custCatalog.filter(c => {
        const nameClean = removeAccents(c.customer);
        const contactClean = removeAccents(c.contact);
        const taxClean = removeAccents(c.taxId);
        const phoneClean = removeAccents(c.phone);
        return nameClean.includes(cleanVal) || contactClean.includes(cleanVal) || taxClean.includes(cleanVal) || phoneClean.includes(cleanVal);
      });
      setCustSearchResults(results.slice(0, 20));
      setShowCustSearch(results.length > 0);
    } else {
      setCustSearchResults(custCatalog.slice(0, 20));
      setShowCustSearch(custCatalog.length > 0);
    }
  };

  const selectCustomer = (c) => {
    setForm(p => ({
      ...p,
      customer: c.customer,
      contact: c.contact || "",
      address: c.address || "",
      taxId: c.taxId || "",
      phone: c.phone || ""
    }));
    setShowCustSearch(false);
  };

  const setItem = useCallback((idx, f, v) => {
    setForm(p => {
      const items = [...p.items];
      items[idx] = { ...items[idx], [f]: v };
      return { ...p, items };
    });
  }, []);

  const setItemFields = useCallback((idx, fields) => {
    setForm(p => {
      const items = [...p.items];
      items[idx] = { ...items[idx], ...fields };
      return { ...p, items };
    });
  }, []);

  const addItem = useCallback(() => {
    setForm(p => ({
      ...p,
      items: [...p.items, { id: generateId(), name: "", note: "", qty: 1, unit: "Cái", price: 0, cost: 0, costNoVat: 0, image: "", vatRate: 8 }]
    }));
  }, []);

  const insertItem = useCallback((targetIdx, position = "below") => {
    setForm(p => {
      const newItem = { id: generateId(), name: "", note: "", qty: 1, unit: "Cái", price: 0, cost: 0, costNoVat: 0, image: "", vatRate: 8 };
      const items = [...p.items];
      const insertAt = position === "above" ? targetIdx : targetIdx + 1;
      items.splice(insertAt, 0, newItem);
      return { ...p, items };
    });
  }, []);

  const handleXmlImport = (xmlItems) => {
    const defaultVat = form.vatRate !== undefined ? form.vatRate : 8;
    const newItems = xmlItems.map(it => {
      const vRate = (it.vatRate !== undefined && it.vatRate !== null) ? it.vatRate : defaultVat;
      const r = (vRate === -1 ? 0 : (vRate || 0)) / 100;
      const costNoVat = it.price || 0;
      const cost = Math.round(costNoVat * (1 + r));
      return {
        id: generateId(),
        name: it.name,
        note: "",
        qty: it.qty || 1,
        unit: it.unit || "Cái",
        price: 0,
        costNoVat: costNoVat,
        cost: cost,
        image: "",
        vatRate: vRate
      };
    });
    setForm(p => ({ ...p, items: [...p.items.filter(x => x.name.trim()), ...newItems] }));
    setShowXmlImport(false);
    showToast(`✅ Đã thêm ${newItems.length} mặt hàng từ XML`, 2500);
  };

  const removeItem = useCallback((idx) => {
    setForm(p => ({ ...p, items: p.items.filter((_, i) => i !== idx) }));
  }, []);

  const formatNumberInput = (val) => {
    if (val === undefined || val === null || val === "" || isNaN(val)) return "";
    return Math.round(val).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  const parseNumberInput = (str) => {
    const cleaned = String(str).replace(/\./g, "").replace(/,/g, "");
    return parseInt(cleaned, 10) || 0;
  };

  // Calculations
  const { subtotal, vat, total } = calcItems(form.items, form.vatRate);

  const costSubtotal = form.items.reduce((s, it) => s + (it.qty || 0) * (it.costNoVat || 0), 0);
  const profitBeforeTax = subtotal - costSubtotal;
  const vatInput = form.items.reduce((s, it) => s + (it.qty || 0) * ((it.cost || 0) - (it.costNoVat || 0)), 0);
  const vatDiff = vat - vatInput;
  const tndnTax = profitBeforeTax > 0 ? Math.round(profitBeforeTax * (form.tndnRate !== undefined ? form.tndnRate : 20) / 100) : 0;
  const netProfit = profitBeforeTax - vatDiff - tndnTax;

  const totalHiddenCost = (form.jvHiddenCosts || []).reduce((s, it) => s + (it.amount || 0), 0) + (form.jvHiddenCost || 0);
  const netProfitAfterHidden = netProfit - totalHiddenCost;

  const totalCapitalA = (form.jvPurchasingParty === "B" ? 0 : costSubtotal) + (form.capitalA || 0);
  const totalCapitalB = (form.jvPurchasingParty === "B" ? costSubtotal : 0) + (form.capitalB || 0);
  const totalCapital = totalCapitalA + totalCapitalB;
  const pctA = totalCapital > 0 ? (totalCapitalA / totalCapital) * 100 : 0;
  const pctB = totalCapital > 0 ? (totalCapitalB / totalCapital) * 100 : 0;

  let shareA = 0;
  let shareB = 0;
  if (form.jvSplitMethod === "amount") {
    shareA = form.jvShareAmount || 0;
    shareB = netProfitAfterHidden - shareA;
  } else {
    const sharePctA = form.jvSharePct !== undefined ? form.jvSharePct : 50;
    shareA = Math.round(netProfitAfterHidden * sharePctA / 100);
    shareB = netProfitAfterHidden - shareA;
  }

  const autoCostPaid = form.jvPurchasingParty === "B" ? 0 : form.items.reduce((s, it) => s + (it.qty || 0) * (it.cost || 0), 0);
  const displayCostPaid = form.jvCostPaidByPMC !== undefined && form.jvCostPaidByPMC !== null ? form.jvCostPaidByPMC : autoCostPaid;
  const jvAmountToReturn = total - displayCostPaid - vatDiff - tndnTax - totalHiddenCost - shareA;

  const handleSave = async () => {
    if (!form.customer.trim()) { alert("Vui lòng nhập tên khách hàng."); return; }
    if (form.items.every(it => !it.name.trim())) { alert("Vui lòng nhập ít nhất 1 mặt hàng."); return; }
    setSaving(true);
    try {
      // Save current version snapshot into history before updating
      const snapshot = {
        versionId: generateId(),
        savedAt: new Date().toLocaleString("vi-VN"),
        customer: form.customer,
        total: total,
        items: JSON.parse(JSON.stringify(form.items))
      };
      const updatedVersions = [snapshot, ...(form.versions || [])].slice(0, 15);
      const finalForm = { ...form, versions: updatedVersions };

      await upsertCatalogItems(finalForm.items);
      await upsertCatalogCustomer(finalForm);
      onSave(finalForm);
    } finally {
      setSaving(false);
    }
  };

  const handleRestoreVersion = (ver) => {
    if (ver && ver.items) {
      setForm(p => ({
        ...p,
        customer: ver.customer || p.customer,
        items: JSON.parse(JSON.stringify(ver.items))
      }));
      showToast("🔄 Đã khôi phục dữ liệu từ bản lịch sử!", 2500);
    }
  };

  const [translating, setTranslating] = useState(false);

  const handleAutoTranslate = async () => {
    const lang = form.lang || "vi";
    if (lang === "vi") {
      showToast("💡 Vui lòng chọn ngôn ngữ Song ngữ (Việt - Anh hoặc Việt - Trung)", 2500);
      return;
    }
    setTranslating(true);
    const targetLangCode = lang === "vi_en" ? "en" : "zh-CN";

    const translateStr = async (str) => {
      if (!str || !str.trim()) return "";
      try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=vi&tl=${targetLangCode}&dt=t&q=${encodeURIComponent(str.trim())}`;
        const res = await fetch(url);
        const data = await res.json();
        return data?.[0]?.map(x => x[0]).join("") || str;
      } catch (e) {
        return str;
      }
    };

    try {
      if (form.workContent) {
        const transWork = await translateStr(form.workContent);
        setField("workContentEn", transWork);
      }
      if (form.notes) {
        const transNotes = await translateStr(form.notes);
        setField("notesEn", transNotes);
      }

      const updatedItems = await Promise.all(form.items.map(async it => {
        let nameEn = it.nameEn;
        let noteEn = it.noteEn;
        if (it.name) {
          nameEn = await translateStr(it.name);
        }
        if (it.note) {
          noteEn = await translateStr(it.note);
        }
        return { ...it, nameEn, noteEn };
      }));

      setField("items", updatedItems);
      showToast("✓ Tự động dịch báo giá thành công!", 2000);
    } catch(e) {
      showToast("⚠️ Lỗi dịch: " + e.message, 2500);
    } finally {
      setTranslating(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ padding: 0, background: "var(--bg-app)", backdropFilter: "none" }}>
      <div className="modal" style={{ maxWidth: "100%", maxHeight: "100vh", height: "100vh", borderRadius: 0, border: "none" }}>
        <div className="modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span className="modal-title">{isNew ? "Tạo báo giá mới" : "Chỉnh sửa báo giá"}</span>
            {form.versions && form.versions.length > 0 && (
              <button
                className="btn btn-ghost btn-sm"
                style={{ fontSize: 11, padding: "2px 8px" }}
                onClick={() => setShowHistoryModal(true)}
              >
                📜 Lịch sử ({form.versions.length})
              </button>
            )}
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleAutoTranslate}
              disabled={translating || (form.lang || "vi") === "vi"}
              title="Tự động dịch sang tiếng Anh/Trung"
            >
              {translating ? "⏳ Đang dịch..." : `🌐 Tự động dịch → ${form.lang === "vi_zh" ? "中文" : "EN"}`}
            </button>
          </div>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body">
          <QuoteGeneralForm
            form={form}
            isNew={isNew}
            setField={setField}
            handleCustomerChange={handleCustomerChange}
            showCustSearch={showCustSearch}
            setShowCustSearch={setShowCustSearch}
            custSearchResults={custSearchResults}
            selectCustomer={selectCustomer}
          />

          <QuoteItemsTable
            items={form.items}
            allQuotes={allQuotes}
            vatRate={form.vatRate}
            lang={form.lang}
            onSetItem={setItem}
            onSetItemFields={setItemFields}
            onRemoveItem={removeItem}
            onInsertItem={insertItem}
            onAddItem={addItem}
            onOpenXmlImport={() => setShowXmlImport(true)}
            subtotal={subtotal}
            vat={vat}
            total={total}
            profitBeforeTax={profitBeforeTax}
            netProfit={netProfit}
          />

          <QuoteProfitJVCard
            form={form}
            setField={setField}
            subtotal={subtotal}
            costSubtotal={costSubtotal}
            profitBeforeTax={profitBeforeTax}
            vat={vat}
            vatInput={vatInput}
            vatDiff={vatDiff}
            tndnTax={tndnTax}
            netProfit={netProfit}
            netProfitAfterHidden={netProfitAfterHidden}
            totalCapital={totalCapital}
            totalCapitalA={totalCapitalA}
            totalCapitalB={totalCapitalB}
            pctA={pctA}
            pctB={pctB}
            shareA={shareA}
            shareB={shareB}
            displayCostPaid={displayCostPaid}
            jvAmountToReturn={jvAmountToReturn}
            formatNumberInput={formatNumberInput}
            parseNumberInput={parseNumberInput}
          />

          <QuoteInternalNotes form={form} setField={setField} />
        </div>

        {showXmlImport && (
          <XmlImportModal
            onImport={handleXmlImport}
            onClose={() => setShowXmlImport(false)}
          />
        )}

        {showHistoryModal && (
          <QuoteVersionHistoryModal
            versions={form.versions}
            onRestore={handleRestoreVersion}
            onClose={() => setShowHistoryModal(false)}
          />
        )}

        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "⏳ Đang lưu..." : "💾 Lưu báo giá"}
          </button>
        </div>
      </div>
    </div>
  );
}
