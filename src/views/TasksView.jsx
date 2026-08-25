import React, { useState, useEffect } from 'react';
import { loadTasks, saveTasks } from '../utils/gasStore';

const TASK_STATUSES = ["todo", "doing", "done"];
const TASK_STATUS_LABELS = { todo: "Cần làm", doing: "Đang làm", done: "Xong" };
const TASK_STATUS_COLORS = { todo: "#6b7280", doing: "#2563eb", done: "#16a34a" };
const TASK_PRIORITIES = ["high", "medium", "low"];
const TASK_PRIORITY_LABELS = { high: "Khẩn", medium: "Bình thường", low: "Thấp" };

function genTaskId() { return "t" + Date.now().toString(36) + Math.random().toString(36).slice(2,6); }

function todayISO() { return new Date().toISOString().slice(0,10); }

function isOverdue(task) {
  if (!task.dueDate || task.status === "done") return false;
  return task.dueDate < todayISO();
}

function TaskFormModal({ task, quotes, onSave, onClose }) {
  const isNew = !task;
  const [form, setForm] = useState(task ? { ...task } : {
    id: genTaskId(), title: "", description: "", status: "todo",
    priority: "medium", progress: 0, dueDate: todayISO(),
    quoteId: "", createdAt: new Date().toISOString(),
  });
  const set = (f, v) => setForm(p => ({ ...p, [f]: v }));

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 520, height: "auto", maxHeight: "90vh" }}>
        <div className="modal-header">
          <span className="modal-title">{isNew ? "➕ Thêm công việc" : "✏️ Sửa công việc"}</span>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="form-group">
            <label>Tên công việc *</label>
            <input className="form-control" value={form.title} onChange={e => set("title", e.target.value)} placeholder="VD: Gọi điện cho khách hàng A..." autoFocus />
          </div>
          <div className="form-group">
            <label>Mô tả chi tiết</label>
            <textarea className="form-control" rows={3} value={form.description || ""} onChange={e => set("description", e.target.value)} placeholder="Ghi chú thêm..." />
          </div>
          <div className="form-row form-row-3">
            <div className="form-group">
              <label>Trạng thái</label>
              <select className="form-control" value={form.status} onChange={e => set("status", e.target.value)}>
                {TASK_STATUSES.map(s => <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Độ ưu tiên</label>
              <select className="form-control" value={form.priority} onChange={e => set("priority", e.target.value)}>
                {TASK_PRIORITIES.map(p => <option key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Deadline</label>
              <input className="form-control" type="date" value={form.dueDate || ""} onChange={e => set("dueDate", e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label>Tiến độ: <strong>{form.progress}%</strong></label>
            <input type="range" min={0} max={100} step={5} value={form.progress}
              onChange={e => { const v = Number(e.target.value); set("progress", v); if (v === 100) set("status", "done"); else if (v > 0 && form.status === "todo") set("status", "doing"); }}
              style={{ width: "100%", accentColor: "#1a2540" }} />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#aaa", marginTop: 2 }}>
              <span>0%</span><span>50%</span><span>100%</span>
            </div>
          </div>
          <div className="form-group">
            <label>Liên kết báo giá (tùy chọn)</label>
            <select className="form-control" value={form.quoteId || ""} onChange={e => set("quoteId", e.target.value)}>
              <option value="">— Không liên kết —</option>
              {(quotes || []).map(q => (
                <option key={q.id} value={q.id}>{q.quoteNumber} – {q.customer}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose}>Hủy</button>
          <button className="btn btn-primary" onClick={() => { if (!form.title.trim()) { alert("Vui lòng nhập tên công việc"); return; } onSave(form); }}>
            💾 Lưu
          </button>
        </div>
      </div>
    </div>
  );
}

function TaskCard({ task, quotes, onEdit, onDelete, onProgressChange, onStatusChange, draggable, onDragStart, onDragOver, onDrop }) {
  const linkedQuote = task.quoteId ? (quotes || []).find(q => q.id === task.quoteId) : null;
  const overdue = isOverdue(task);

  return (
    <div className="task-card"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={e => { e.preventDefault(); onDragOver && onDragOver(e); }}
      onDrop={onDrop}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
        <span className={`priority-dot priority-${task.priority || "medium"}`} style={{ marginTop: 4 }} />
        <div style={{ flex: 1 }}>
          <div className="task-title" style={{ textDecoration: task.status === "done" ? "line-through" : "none", color: task.status === "done" ? "#aaa" : "#1a2540" }}>
            {task.title}
          </div>
          {task.description && <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{task.description}</div>}
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <button onClick={() => onEdit(task)} style={{ background: "none", border: "none", cursor: "pointer", color: "#888", fontSize: 14, padding: "2px 4px" }}>✏️</button>
          <button onClick={() => onDelete(task.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 14, padding: "2px 4px", opacity: 0.5 }}
            onMouseEnter={e => e.currentTarget.style.opacity = "1"}
            onMouseLeave={e => e.currentTarget.style.opacity = "0.5"}
          >🗑️</button>
        </div>
      </div>
      <div className="task-meta">
        {task.dueDate && (
          <span style={{ color: overdue ? "#dc2626" : "#888" }}>
            {overdue ? "⚠️ " : "📅 "}{task.dueDate}
          </span>
        )}
        {task.priority === "high" && <span className="task-tag urgent">🔴 Khẩn</span>}
        {linkedQuote && <span className="task-tag linked">🔗 {linkedQuote.quoteNumber}</span>}
      </div>
      <div style={{ marginTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="progress-bar" style={{ flex: 1 }}>
            <div className="progress-fill" style={{ width: (task.progress || 0) + "%", background: task.status === "done" ? "#16a34a" : "#1a2540" }} />
          </div>
          <input className="task-progress-input" type="number" min={0} max={100} value={task.progress || 0}
            onChange={e => onProgressChange(task.id, Number(e.target.value))}
            onClick={e => e.stopPropagation()} />
          <span style={{ fontSize: 11, color: "#888" }}>%</span>
        </div>
      </div>
    </div>
  );
}

export default function TasksView({ quotes }) {
  const [tasks, setTasks]           = useState([]);
  const [loaded, setLoaded]         = useState(false);
  const [editTask, setEditTask]     = useState(null);
  const [showForm, setShowForm]     = useState(false);
  const [filterPri, setFilterPri]   = useState("all");
  const [dragId, setDragId]         = useState(null);
  const [search, setSearch]         = useState("");

  useEffect(() => {
    loadTasks().then(t => { setTasks(t || []); setLoaded(true); }).catch(() => setLoaded(true));
  }, []);

  const persist = (newTasks) => { setTasks(newTasks); saveTasks(newTasks); };

  const saveTask = (task) => {
    const idx = tasks.findIndex(t => t.id === task.id);
    const updated = idx >= 0 ? tasks.map(t => t.id === task.id ? task : t) : [task, ...tasks];
    persist(updated);
    setShowForm(false); setEditTask(null);
  };

  const deleteTask = (id) => { if (window.confirm("Xóa công việc này?")) persist(tasks.filter(t => t.id !== id)); };

  const updateProgress = (id, val) => {
    persist(tasks.map(t => t.id === id ? {
      ...t, progress: Math.max(0, Math.min(100, val)),
      status: val >= 100 ? "done" : val > 0 ? "doing" : "todo"
    } : t));
  };

  const updateStatus = (id, status) => {
    persist(tasks.map(t => t.id === id ? {
      ...t, status,
      progress: status === "done" ? 100 : status === "todo" ? 0 : t.progress
    } : t));
  };

  const handleDrop = (targetStatus) => {
    if (!dragId) return;
    updateStatus(dragId, targetStatus);
    setDragId(null);
  };

  const filtered = tasks.filter(t => {
    const matchPri = filterPri === "all" || t.priority === filterPri;
    const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase());
    return matchPri && matchSearch;
  });

  const todayTasks = filtered.filter(t => t.dueDate === todayISO() && t.status !== "done");
  const overdueTasks = filtered.filter(t => isOverdue(t));
  const upcomingTasks = filtered.filter(t => t.dueDate > todayISO() && t.status !== "done");
  const doneTasks = filtered.filter(t => t.status === "done");

  const total = tasks.length;
  const doneCount = tasks.filter(t => t.status === "done").length;
  const overdueCount = tasks.filter(t => isOverdue(t)).length;
  const avgProgress = total ? Math.round(tasks.reduce((s, t) => s + (t.progress || 0), 0) / total) : 0;

  if (!loaded) return <div className="empty-state"><div style={{fontSize:32}}>⏳</div><h3>Đang tải công việc...</h3></div>;

  return (
    <div>
      <div style={{ marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap:"wrap", gap: 10 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "#1a2540", marginBottom: 4 }}>📋 Công việc hằng ngày</h2>
          <p style={{ color: "#888", fontSize: 13 }}>{total} công việc · {doneCount} hoàn thành · {overdueCount > 0 ? `${overdueCount} quá hạn ⚠️` : "không quá hạn"}</p>
        </div>
        <button className="btn btn-primary" onClick={() => { setEditTask(null); setShowForm(true); }}>+ Thêm công việc</button>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: 16 }}>
        {[
          { label: "Tổng", value: total, sub: "công việc" },
          { label: "Hoàn thành", value: doneCount, sub: `${total ? Math.round(doneCount/total*100) : 0}%`, color: "#16a34a" },
          { label: "Quá hạn", value: overdueCount, sub: "cần xử lý", color: overdueCount > 0 ? "#dc2626" : "#888" },
          { label: "Tiến độ TB", value: avgProgress + "%", sub: "toàn bộ", color: "#2563eb" },
        ].map(s => (
          <div className="stat-card" key={s.label}>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color || "#1a2540", fontSize: 20 }}>{s.value}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="filter-bar" style={{ marginBottom: 16 }}>
        <input className="search-input" placeholder="🔍 Tìm công việc..." value={search} onChange={e => setSearch(e.target.value)} />
        <select className="form-control" style={{ width: "auto" }} value={filterPri} onChange={e => setFilterPri(e.target.value)}>
          <option value="all">Tất cả ưu tiên</option>
          {TASK_PRIORITIES.map(p => <option key={p} value={p}>{TASK_PRIORITY_LABELS[p]}</option>)}
        </select>
      </div>

      {(todayTasks.length > 0 || overdueTasks.length > 0) && (
        <div className="card" style={{ marginBottom: 16 }}>
          {overdueTasks.length > 0 && (
            <>
              <div className="card-header" style={{ background: "#fff5f5" }}>
                <span style={{ fontWeight: 600, color: "#dc2626" }}>⚠️ Quá hạn ({overdueTasks.length})</span>
              </div>
              {overdueTasks.map(t => (
                <div key={t.id} className="task-list-item">
                  <div className={`task-checkbox ${t.status === "done" ? "checked" : ""}`}
                    onClick={() => updateStatus(t.id, t.status === "done" ? "todo" : "done")}>
                    {t.status === "done" && "✓"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, color: "#dc2626", textDecoration: t.status === "done" ? "line-through" : "none" }}>{t.title}</div>
                    <div style={{ fontSize: 11, color: "#dc2626", marginTop: 2 }}>Deadline: {t.dueDate}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div className="progress-bar" style={{ width: 80 }}>
                      <div className="progress-fill" style={{ width: (t.progress||0)+"%", background: "#dc2626" }} />
                    </div>
                    <span style={{ fontSize: 11, color: "#888", minWidth: 30 }}>{t.progress||0}%</span>
                    <button onClick={() => { setEditTask(t); setShowForm(true); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#888" }}>✏️</button>
                  </div>
                </div>
              ))}
            </>
          )}
          {todayTasks.length > 0 && (
            <>
              <div className="card-header">
                <span style={{ fontWeight: 600, color: "#1a2540" }}>📅 Hôm nay ({todayTasks.length})</span>
              </div>
              {todayTasks.map(t => (
                <div key={t.id} className="task-list-item">
                  <div className={`task-checkbox ${t.status === "done" ? "checked" : ""}`}
                    onClick={() => updateStatus(t.id, t.status === "done" ? "todo" : "done")}>
                    {t.status === "done" && "✓"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, textDecoration: t.status === "done" ? "line-through" : "none" }}>{t.title}</div>
                    {t.description && <div style={{ fontSize: 11, color: "#888", marginTop: 1 }}>{t.description}</div>}
                    {(() => { const q = t.quoteId && quotes.find(x => x.id === t.quoteId); return q ? <span className="task-tag linked" style={{ marginTop: 2, display: "inline-block" }}>🔗 {q.quoteNumber}</span> : null; })()}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <input className="task-progress-input" type="number" min={0} max={100} value={t.progress||0}
                      onChange={e => updateProgress(t.id, Number(e.target.value))} />
                    <span style={{ fontSize: 11, color: "#888" }}>%</span>
                    <button onClick={() => { setEditTask(t); setShowForm(true); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#888" }}>✏️</button>
                  </div>
                </div>
              ))}
            </>
          )}
          {upcomingTasks.length > 0 && (
            <>
              <div className="card-header">
                <span style={{ fontWeight: 600, color: "#666" }}>🗓️ Sắp tới ({upcomingTasks.length})</span>
              </div>
              {upcomingTasks.slice(0,5).map(t => (
                <div key={t.id} className="task-list-item">
                  <div className={`task-checkbox ${t.status === "done" ? "checked" : ""}`}
                    onClick={() => updateStatus(t.id, t.status === "done" ? "todo" : "done")}>
                    {t.status === "done" && "✓"}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500 }}>{t.title}</div>
                    <div style={{ fontSize: 11, color: "#888" }}>📅 {t.dueDate}</div>
                  </div>
                  <button onClick={() => { setEditTask(t); setShowForm(true); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#888" }}>✏️</button>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {tasks.length === 0 && (
        <div className="empty-state">
          <div style={{ fontSize: 40 }}>📋</div>
          <h3>Chưa có công việc nào</h3>
          <p style={{ fontSize: 13 }}>Bấm "+ Thêm công việc" để bắt đầu</p>
        </div>
      )}

      {tasks.length > 0 && (
        <div>
          <div className="section-title" style={{ marginTop: 8 }}>🗂️ Bảng Kanban</div>
          <div className="kanban-wrap">
            {TASK_STATUSES.map(status => {
              const col = filtered.filter(t => t.status === status);
              return (
                <div key={status} className="kanban-col"
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => handleDrop(status)}
                  style={{ borderTop: `3px solid ${TASK_STATUS_COLORS[status]}` }}>
                  <div className="kanban-col-header">
                    <span style={{ color: TASK_STATUS_COLORS[status] }}>{TASK_STATUS_LABELS[status]}</span>
                    <span className="kanban-col-count">{col.length}</span>
                  </div>
                  {col.length === 0 && (
                    <div style={{ textAlign: "center", color: "#ccc", fontSize: 12, padding: "20px 0" }}>Thả công việc vào đây</div>
                  )}
                  {col.map(t => (
                    <TaskCard key={t.id} task={t} quotes={quotes}
                      onEdit={t => { setEditTask(t); setShowForm(true); }}
                      onDelete={deleteTask}
                      onProgressChange={updateProgress}
                      onStatusChange={updateStatus}
                      draggable
                      onDragStart={() => setDragId(t.id)}
                    />
                  ))}
                  <button className="btn btn-ghost btn-sm" style={{ width: "100%", marginTop: 4, justifyContent: "center" }}
                    onClick={() => { setEditTask({ id: genTaskId(), title: "", status, priority: "medium", progress: status === "done" ? 100 : 0, dueDate: todayISO(), createdAt: new Date().toISOString() }); setShowForm(true); }}>
                    + Thêm
                  </button>
                </div>
              );
            })}
          </div>

          {doneTasks.length > 0 && (
            <details style={{ marginTop: 16 }}>
              <summary style={{ cursor: "pointer", fontSize: 13, color: "#888", padding: "8px 0", userSelect: "none" }}>
                ✅ Đã hoàn thành ({doneTasks.length}) — click để xem
              </summary>
              <div className="card" style={{ marginTop: 8 }}>
                {doneTasks.map(t => (
                  <div key={t.id} className="task-list-item">
                    <div className="task-checkbox checked" onClick={() => updateStatus(t.id, "todo")}>✓</div>
                    <div style={{ flex: 1, color: "#aaa", textDecoration: "line-through", fontSize: 13 }}>{t.title}</div>
                    <button onClick={() => deleteTask(t.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ddd", fontSize: 13 }}>🗑️</button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {showForm && (
        <TaskFormModal
          task={editTask}
          quotes={quotes}
          onSave={saveTask}
          onClose={() => { setShowForm(false); setEditTask(null); }}
        />
      )}
    </div>
  );
}
