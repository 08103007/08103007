import React, { useState, useEffect } from 'react';
import { loadNotes, saveNotes } from '../utils/gasStore';

const NOTE_COLORS = [
  "#fff9db","#d3f9d8","#d0ebff","#ffe8cc","#f8d7e3","#e9ecef","#fff0f6","#e8f5e9"
];
const NOTE_COLOR_NAMES = ["Vàng","Xanh lá","Xanh dương","Cam","Hồng","Xám","Tím","Lá"];

function genNoteId() { return "n" + Date.now().toString(36) + Math.random().toString(36).slice(2,5); }

function NoteFormModal({ note, allTags, onSave, onClose }) {
  const isNew = !note;
  const [form, setForm] = useState(note ? { ...note } : {
    id: genNoteId(), title: "", body: "", tags: [], color: NOTE_COLORS[0],
    pinned: false, createdAt: new Date().toISOString(),
  });
  const [tagInput, setTagInput] = useState("");
  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const addTag = (tag) => {
    tag = tag.trim();
    if (!tag || form.tags.includes(tag)) return;
    set("tags", [...form.tags, tag]);
    setTagInput("");
  };
  const removeTag = (tag) => set("tags", form.tags.filter(t => t !== tag));

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:560, height:"auto", maxHeight:"90vh" }}>
        <div className="modal-header">
          <span className="modal-title">{isNew ? "📝 Ghi chú mới" : "✏️ Sửa ghi chú"}</span>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ display:"flex", flexDirection:"column", gap:14 }}>

          <div className="form-group" style={{ marginBottom:0 }}>
            <label>Màu nền</label>
            <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginTop:4 }}>
              {NOTE_COLORS.map((col, i) => (
                <button key={col} onClick={() => set("color", col)} title={NOTE_COLOR_NAMES[i]}
                  style={{ width:28, height:28, borderRadius:"50%", background:col, border: form.color===col ? "2px solid #1a2540" : "1px solid #d1cfc6", cursor:"pointer" }} />
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Tiêu đề</label>
            <input className="form-control" value={form.title} onChange={e => set("title", e.target.value)}
              placeholder="Tiêu đề ghi chú..." autoFocus />
          </div>

          <div className="form-group">
            <label>Nội dung <span style={{fontSize:11,color:"#aaa",fontWeight:400}}>(chỉ dùng nội bộ, không xuất ra ngoài)</span></label>
            <textarea className="form-control" rows={8} value={form.body} onChange={e => set("body", e.target.value)}
              placeholder="Ghi chú bất kỳ thông tin nội bộ: giá vốn, ghi nhớ, thông tin đàm phán..." />
          </div>

          <div className="form-group" style={{ marginBottom:0 }}>
            <label>Nhãn (tags)</label>
            <div style={{ display:"flex", gap:8, marginBottom:6, flexWrap:"wrap" }}>
              {form.tags.map(tag => (
                <span key={tag} style={{ background:"#1a2540", color:"#fff", padding:"2px 8px", borderRadius:10, fontSize:12, display:"flex", alignItems:"center", gap:4 }}>
                  {tag}
                  <button onClick={() => removeTag(tag)} style={{ background:"none", border:"none", color:"#fff", cursor:"pointer", padding:0, fontSize:14, lineHeight:1 }}>×</button>
                </span>
              ))}
            </div>
            <div style={{ display:"flex", gap:8 }}>
              <input className="form-control" style={{ flex:1 }} value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(tagInput); } }}
                placeholder="Nhập tag rồi Enter... (VD: khách VIP, ưu tiên, nội bộ)" />
              <button className="btn btn-ghost btn-sm" onClick={() => addTag(tagInput)}>+ Thêm</button>
            </div>
            {allTags.filter(t => !form.tags.includes(t) && t.toLowerCase().includes(tagInput.toLowerCase()) && tagInput).length > 0 && (
              <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:6 }}>
                {allTags.filter(t => !form.tags.includes(t) && t.toLowerCase().includes(tagInput.toLowerCase()) && tagInput).slice(0,8).map(t => (
                  <span key={t} className="note-tag" onClick={() => addTag(t)}>{t}</span>
                ))}
              </div>
            )}
          </div>

          <label style={{ display:"flex", alignItems:"center", gap:8, cursor:"pointer", fontSize:13 }}>
            <input type="checkbox" checked={form.pinned} onChange={e => set("pinned", e.target.checked)} />
            📌 Ghim ghi chú này lên đầu
          </label>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" onClick={() => {
            if (!form.title.trim() && !form.body.trim()) { alert("Vui lòng nhập tiêu đề hoặc nội dung"); return; }
            onSave({ ...form, updatedAt: new Date().toISOString() });
          }}>💾 Lưu ghi chú</button>
        </div>
      </div>
    </div>
  );
}

export default function NotesView() {
  const [notes, setNotes]       = useState([]);
  const [loaded, setLoaded]     = useState(false);
  const [editNote, setEditNote] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch]     = useState("");
  const [activeTag, setActiveTag] = useState("all");
  const [viewMode, setViewMode] = useState("grid"); 

  useEffect(() => {
    loadNotes().then(n => { setNotes(n || []); setLoaded(true); }).catch(() => setLoaded(true));
  }, []);

  const persist = (n) => { setNotes(n); saveNotes(n); };

  const saveNote = (note) => {
    const idx = notes.findIndex(n => n.id === note.id);
    const updated = idx >= 0 ? notes.map(n => n.id === note.id ? note : n) : [note, ...notes];
    persist(updated);
    setShowForm(false); setEditNote(null);
  };

  const deleteNote = (id) => { if (window.confirm("Xóa ghi chú này?")) persist(notes.filter(n => n.id !== id)); };
  const togglePin = (id) => persist(notes.map(n => n.id === id ? { ...n, pinned: !n.pinned } : n));

  const allTags = [...new Set(notes.flatMap(n => n.tags || []))].sort();

  const filtered = notes
    .filter(n => {
      const matchTag = activeTag === "all" || (n.tags || []).includes(activeTag);
      const matchSearch = !search ||
        (n.title || "").toLowerCase().includes(search.toLowerCase()) ||
        (n.body  || "").toLowerCase().includes(search.toLowerCase()) ||
        (n.tags  || []).some(t => t.toLowerCase().includes(search.toLowerCase()));
      return matchTag && matchSearch;
    })
    .sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || "");
    });

  const fmtDate = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  };

  if (!loaded) return <div className="empty-state"><div style={{fontSize:32}}>⏳</div><h3>Đang tải ghi chú...</h3></div>;

  return (
    <div>
      <div style={{ marginBottom:20, display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
        <div>
          <h2 style={{ fontSize:18, fontWeight:600, color:"#1a2540", marginBottom:4 }}>📝 Ghi chú nội bộ</h2>
          <p style={{ color:"#888", fontSize:13 }}>{notes.length} ghi chú · Chỉ hiển thị nội bộ, không xuất ra báo giá/hợp đồng</p>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setViewMode(v => v==="grid"?"list":"grid")} title="Chuyển chế độ xem">
            {viewMode==="grid" ? "☰ List" : "⊞ Grid"}
          </button>
          <button className="btn btn-primary" onClick={() => { setEditNote(null); setShowForm(true); }}>+ Ghi chú mới</button>
        </div>
      </div>

      <div className="filter-bar" style={{ marginBottom:14 }}>
        <input className="search-input" placeholder="🔍 Tìm trong ghi chú..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {allTags.length > 0 && (
        <div className="note-tag-list" style={{ marginBottom:14 }}>
          <span className={`note-tag ${activeTag==="all"?"active":""}`} onClick={() => setActiveTag("all")}>Tất cả</span>
          {allTags.map(tag => (
            <span key={tag} className={`note-tag ${activeTag===tag?"active":""}`} onClick={() => setActiveTag(t => t===tag?"all":tag)}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {notes.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize:40 }}>📝</div>
          <h3>Chưa có ghi chú nào</h3>
          <p style={{ fontSize:13 }}>Dùng để lưu thông tin nội bộ: giá vốn, ghi nhớ quan trọng, thông tin đàm phán...</p>
          <button className="btn btn-primary" style={{ marginTop:12 }} onClick={() => setShowForm(true)}>+ Tạo ghi chú đầu tiên</button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div style={{ fontSize:32 }}>🔍</div>
          <h3>Không tìm thấy ghi chú</h3>
        </div>
      ) : viewMode === "grid" ? (
        <div className="notes-grid">
          {filtered.map(note => (
            <div key={note.id} className={`note-card ${note.pinned?"pinned":""}`} style={{ background: note.color || "#fff" }}>
              <div className="note-actions">
                <button className="note-pin-btn" onClick={() => togglePin(note.id)} title={note.pinned?"Bỏ ghim":"Ghim"}>
                  {note.pinned ? "📌" : "📍"}
                </button>
                <button className="note-pin-btn" onClick={() => { setEditNote(note); setShowForm(true); }} title="Sửa">✏️</button>
                <button className="note-pin-btn" onClick={() => deleteNote(note.id)} title="Xóa" style={{ color:"#dc2626" }}>🗑️</button>
              </div>
              {note.pinned && <div style={{ fontSize:11, color:"#f59e0b", fontWeight:600, marginBottom:4 }}>📌 Đã ghim</div>}
              {note.title && <div className="note-title">{note.title}</div>}
              {note.body && (
                <div className="note-body" style={{ maxHeight:120, overflow:"hidden", maskImage:"linear-gradient(to bottom,black 70%,transparent 100%)", WebkitMaskImage:"linear-gradient(to bottom,black 70%,transparent 100%)" }}>
                  {note.body}
                </div>
              )}
              {(note.tags||[]).length > 0 && (
                <div className="note-tag-list" style={{ marginTop:8 }}>
                  {note.tags.map(t => <span key={t} className="note-tag" onClick={() => setActiveTag(t)}>{t}</span>)}
                </div>
              )}
              <div className="note-meta">
                <span>🕐 {fmtDate(note.updatedAt || note.createdAt)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="card">
          {filtered.map(note => (
            <div key={note.id} style={{ padding:"12px 16px", borderBottom:"1px solid #f0ede6", display:"flex", gap:12, alignItems:"flex-start", background: note.color || "#fff" }}>
              <div style={{ width:6, borderRadius:3, alignSelf:"stretch", background: note.pinned ? "#f59e0b" : "transparent", flexShrink:0 }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                  <div>
                    {note.title && <div style={{ fontWeight:600, fontSize:14, color:"#1a2540" }}>{note.title}</div>}
                    {note.body && <div style={{ fontSize:13, color:"#555", marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", maxWidth:500 }}>{note.body.slice(0,120)}{note.body.length>120?"…":""}</div>}
                  </div>
                  <div style={{ display:"flex", gap:4, flexShrink:0, marginLeft:8 }}>
                    <button onClick={() => togglePin(note.id)} style={{ background:"none", border:"none", cursor:"pointer", fontSize:14 }}>{note.pinned?"📌":"📍"}</button>
                    <button onClick={() => { setEditNote(note); setShowForm(true); }} style={{ background:"none", border:"none", cursor:"pointer", color:"#888", fontSize:14 }}>✏️</button>
                    <button onClick={() => deleteNote(note.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#dc2626", fontSize:14 }}>🗑️</button>
                  </div>
                </div>
                <div style={{ display:"flex", gap:6, marginTop:5, flexWrap:"wrap", alignItems:"center" }}>
                  {(note.tags||[]).map(t => <span key={t} className="note-tag">{t}</span>)}
                  <span style={{ fontSize:11, color:"#aaa" }}>🕐 {fmtDate(note.updatedAt||note.createdAt)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <NoteFormModal
          note={editNote}
          allTags={allTags}
          onSave={saveNote}
          onClose={() => { setShowForm(false); setEditNote(null); }}
        />
      )}
    </div>
  );
}
