import { useState } from 'react';
import type { Requirement } from '../api/client';
import { useStore, generateId } from '../store/useStore';

const PRIORITIES = ['Critical', 'High', 'Medium', 'Low'];
const STATUSES = ['Draft', 'Approved', 'In Progress', 'Completed', 'Rejected'];
const TAGS_OPTIONS = ['功能', '效能', '安全', 'UI/UX', '資料', '整合'];

export default function RequirementsManager() {
  const { requirements, setRequirements, selectedRequirementId, setSelectedRequirementId } = useStore();
  const [editing, setEditing] = useState<Partial<Requirement> | null>(null);
  const [filterPriority, setFilterPriority] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTag, setFilterTag] = useState('');

  const filteredReqs = requirements.filter(r => {
    if (filterPriority && r.priority !== filterPriority) return false;
    if (filterStatus && r.status !== filterStatus) return false;
    if (filterTag && !r.tags.includes(filterTag)) return false;
    return true;
  });

  const handleCreate = () => {
    setEditing({
      title: '',
      description: '',
      tags: [],
      priority: 'Medium',
      status: 'Draft',
    });
    setSelectedRequirementId(null);
  };

  const handleSave = () => {
    if (!editing || !editing.title) return;
    const now = new Date().toISOString();
    if (selectedRequirementId) {
      setRequirements(requirements.map(r =>
        r.id === selectedRequirementId ? { ...r, ...editing, updatedAt: now } : r
      ));
    } else {
      const newReq: Requirement = {
        id: generateId('req'),
        title: editing.title || '',
        description: editing.description || '',
        tags: editing.tags || [],
        priority: editing.priority || 'Medium',
        status: editing.status || 'Draft',
        createdAt: now,
        updatedAt: now,
      };
      setRequirements([...requirements, newReq]);
    }
    setEditing(null);
    setSelectedRequirementId(null);
  };

  const handleEdit = (req: Requirement) => {
    setSelectedRequirementId(req.id);
    setEditing({ ...req });
  };

  const handleDelete = (id: string) => {
    if (confirm('確定刪除此需求？')) {
      setRequirements(requirements.filter(r => r.id !== id));
      if (selectedRequirementId === id) setSelectedRequirementId(null);
    }
  };

  const toggleTag = (tag: string) => {
    if (!editing) return;
    const tags = editing.tags || [];
    setEditing({
      ...editing,
      tags: tags.includes(tag) ? tags.filter(t => t !== tag) : [...tags, tag],
    });
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'Critical': return '#f38ba8';
      case 'High': return '#f9e2af';
      case 'Medium': return '#89b4fa';
      case 'Low': return '#a6adc8';
      default: return '#cdd6f4';
    }
  };

  return (
    <div className="requirements-manager">
      <div className="req-toolbar">
        <button className="btn btn-primary btn-sm" onClick={handleCreate}>+ 新增需求</button>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}>
          <option value="">全部優先級</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">全部狀態</option>
          {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <span className="req-count">{filteredReqs.length} 項需求</span>
      </div>

      <div className="req-content">
        <div className="req-list">
          {filteredReqs.map(req => (
            <div
              key={req.id}
              className={`req-item ${selectedRequirementId === req.id ? 'selected' : ''}`}
              onClick={() => handleEdit(req)}
            >
              <div className="req-item-header">
                <span className="req-title">{req.title}</span>
                <span className="req-priority" style={{ color: getPriorityColor(req.priority) }}>
                  {req.priority}
                </span>
              </div>
              <div className="req-item-meta">
                <span className="req-status">{req.status}</span>
                {req.tags.map(t => <span key={t} className="req-tag">{t}</span>)}
              </div>
              <button className="btn btn-danger btn-xs req-delete" onClick={e => { e.stopPropagation(); handleDelete(req.id); }}>✕</button>
            </div>
          ))}
          {filteredReqs.length === 0 && (
            <div className="req-empty">尚無需求，點擊「+ 新增需求」開始</div>
          )}
        </div>

        {editing && (
          <div className="req-editor">
            <div className="form-group">
              <label>標題</label>
              <input value={editing.title || ''} onChange={e => setEditing({ ...editing, title: e.target.value })} placeholder="需求標題" />
            </div>
            <div className="form-group">
              <label>描述</label>
              <textarea value={editing.description || ''} onChange={e => setEditing({ ...editing, description: e.target.value })} rows={4} placeholder="詳細描述..." />
            </div>
            <div className="form-group">
              <label>優先級</label>
              <select value={editing.priority || 'Medium'} onChange={e => setEditing({ ...editing, priority: e.target.value })}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>狀態</label>
              <select value={editing.status || 'Draft'} onChange={e => setEditing({ ...editing, status: e.target.value })}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>標籤</label>
              <div className="tag-buttons">
                {TAGS_OPTIONS.map(tag => (
                  <button
                    key={tag}
                    className={`flag-btn ${(editing.tags || []).includes(tag) ? 'active' : ''}`}
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
            <div className="req-editor-actions">
              <button className="btn btn-primary btn-sm" onClick={handleSave}>💾 儲存</button>
              <button className="btn btn-sm" onClick={() => { setEditing(null); setSelectedRequirementId(null); }}>取消</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
