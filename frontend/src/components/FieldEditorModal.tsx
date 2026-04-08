import { useState, useCallback, useEffect, useRef } from 'react';
import { useStore, generateId } from '../store/useStore';
import type { ERField } from '../api/client';

const DATA_TYPES = [
  'INT', 'BIGINT', 'SMALLINT', 'TINYINT',
  'DECIMAL', 'NUMERIC', 'FLOAT', 'REAL',
  'VARCHAR', 'NVARCHAR', 'CHAR', 'NCHAR', 'TEXT', 'NTEXT',
  'DATE', 'TIME', 'DATETIME', 'DATETIME2', 'TIMESTAMP',
  'BIT', 'BOOLEAN',
  'BLOB', 'VARBINARY', 'IMAGE',
  'UUID', 'JSON', 'XML',
];

const TYPE_HAS_LENGTH = ['VARCHAR', 'NVARCHAR', 'CHAR', 'NCHAR', 'VARBINARY'];
const TYPE_HAS_PRECISION = ['DECIMAL', 'NUMERIC'];

interface Props {
  entityId: string;
  onClose: () => void;
}

export default function FieldEditorModal({ entityId, onClose }: Props) {
  const {
    erEntities,
    updateErEntity,
    removeErEntity,
    addFieldToEntity,
    updateFieldInEntity,
    removeFieldFromEntity,
  } = useStore();

  const entity = erEntities.find(e => e.id === entityId);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [entityName, setEntityName] = useState(entity?.name || '');
  const [entityNotes, setEntityNotes] = useState(entity?.notes || '');

  // Drag state
  const modalRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 150, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.modal-header')) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  }, [position]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y,
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  useEffect(() => {
    if (entity) {
      setEntityName(entity.name);
      setEntityNotes(entity.notes || '');
    }
  }, [entity]);

  if (!entity) return null;

  const handleSaveEntity = () => {
    updateErEntity(entityId, { name: entityName, notes: entityNotes });
  };

  const handleDeleteEntity = () => {
    if (confirm(`確定刪除 Entity「${entity.name}」？此操作無法復原。`)) {
      removeErEntity(entityId);
      onClose();
    }
  };

  const handleAddField = () => {
    const field: ERField = {
      id: generateId('field'),
      name: `field_${entity.fields.length + 1}`,
      dataType: 'VARCHAR',
      length: 255,
      precision: null,
      scale: null,
      isPrimaryKey: false,
      isForeignKey: false,
      isNullable: true,
      isUnique: false,
      hasDefault: false,
      defaultValue: '',
      referencedEntity: '',
      referencedField: '',
      notes: '',
    };
    addFieldToEntity(entityId, field);
    setSelectedFieldId(field.id);
  };

  const handleFieldUpdate = (fieldId: string, updates: Partial<ERField>) => {
    updateFieldInEntity(entityId, fieldId, updates);
  };

  const handleRemoveField = (fieldId: string) => {
    removeFieldFromEntity(entityId, fieldId);
    if (selectedFieldId === fieldId) setSelectedFieldId(null);
  };

  const handleTogglePK = (field: ERField) => {
    if (!field.isPrimaryKey) {
      handleFieldUpdate(field.id, { isPrimaryKey: true, isNullable: false, isForeignKey: false });
    } else {
      handleFieldUpdate(field.id, { isPrimaryKey: false });
    }
  };

  const handleToggleFK = (field: ERField) => {
    if (!field.isForeignKey) {
      handleFieldUpdate(field.id, { isForeignKey: true, isPrimaryKey: false });
    } else {
      handleFieldUpdate(field.id, { isForeignKey: false, referencedEntity: '', referencedField: '' });
    }
  };

  const pkFields = entity.fields.filter(f => f.isPrimaryKey);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div 
        className="modal" 
        onClick={e => e.stopPropagation()}
        onMouseDown={handleMouseDown}
        ref={modalRef}
        style={{ 
          position: 'fixed' as const,
          left: position.x,
          top: position.y,
          cursor: isDragging ? 'grabbing' : undefined,
        }}
      >
        <div className="modal-header">
          <span>✏️ 編輯 Entity</span>
          <button className="btn btn-xs" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Entity name & notes */}
          <div className="modal-section">
            <div className="form-row">
              <div className="form-group" style={{ flex: 2 }}>
                <label>Entity 名稱</label>
                <input
                  value={entityName}
                  onChange={e => setEntityName(e.target.value)}
                  onBlur={handleSaveEntity}
                />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>PK</label>
                <div className="pk-display">
                  {pkFields.length > 0
                    ? pkFields.map(f => f.name).join(', ')
                    : '無'}
                </div>
              </div>
            </div>
            <div className="form-group">
              <label>Entity 備註</label>
              <textarea
                value={entityNotes}
                onChange={e => setEntityNotes(e.target.value)}
                onBlur={handleSaveEntity}
                rows={2}
                placeholder="Entity 說明..."
              />
            </div>
          </div>

          {/* Fields */}
          <div className="modal-section">
            <div className="section-header">
              <span>欄位 ({entity.fields.length})</span>
              <button className="btn btn-primary btn-xs" onClick={handleAddField}>+ 新增欄位</button>
            </div>

            <div className="field-table">
              <div className="field-table-header">
                <span className="col-icon"></span>
                <span className="col-name">欄位名稱</span>
                <span className="col-type">類型</span>
                <span className="col-length">長度</span>
                <span className="col-flags">屬性</span>
                <span className="col-actions"></span>
              </div>

              {entity.fields.map(field => (
                <div
                  key={field.id}
                  className={`field-row ${selectedFieldId === field.id ? 'expanded' : ''}`}
                >
                  <div className="field-row-main" onClick={() => setSelectedFieldId(selectedFieldId === field.id ? null : field.id)}>
                    <span className="col-icon">
                      {field.isPrimaryKey ? '🔑' : field.isForeignKey ? '🔗' : '·'}
                    </span>
                    <input
                      className="col-name"
                      value={field.name}
                      onChange={e => handleFieldUpdate(field.id, { name: e.target.value })}
                      onClick={e => e.stopPropagation()}
                    />
                    <select
                      className="col-type"
                      value={field.dataType}
                      onChange={e => handleFieldUpdate(field.id, { dataType: e.target.value })}
                      onClick={e => e.stopPropagation()}
                    >
                      {DATA_TYPES.map(dt => <option key={dt} value={dt}>{dt}</option>)}
                    </select>

                    {/* Length/Precision input - always editable */}
                    <div className="col-length" onClick={e => e.stopPropagation()}>
                      {TYPE_HAS_LENGTH.includes(field.dataType) && (
                        <input
                          type="number"
                          value={field.length ?? ''}
                          onChange={e => handleFieldUpdate(field.id, { length: e.target.value ? parseInt(e.target.value) : null })}
                          placeholder="255"
                        />
                      )}
                      {TYPE_HAS_PRECISION.includes(field.dataType) && (
                        <div className="precision-inputs">
                          <input
                            type="number"
                            value={field.precision ?? ''}
                            onChange={e => handleFieldUpdate(field.id, { precision: e.target.value ? parseInt(e.target.value) : null })}
                            placeholder="P"
                            title="Precision"
                          />
                          <input
                            type="number"
                            value={field.scale ?? ''}
                            onChange={e => handleFieldUpdate(field.id, { scale: e.target.value ? parseInt(e.target.value) : null })}
                            placeholder="S"
                            title="Scale"
                          />
                        </div>
                      )}
                    </div>

                    <div className="col-flags" onClick={e => e.stopPropagation()}>
                      <button
                        className={`flag-btn pk-btn ${field.isPrimaryKey ? 'active' : ''}`}
                        onClick={() => handleTogglePK(field)}
                        title="Primary Key"
                      >PK</button>
                      <button
                        className={`flag-btn fk-btn ${field.isForeignKey ? 'active' : ''}`}
                        onClick={() => handleToggleFK(field)}
                        title="Foreign Key"
                      >FK</button>
                      <button
                        className={`flag-btn nullable-btn ${field.isNullable ? 'active' : ''}`}
                        onClick={() => handleFieldUpdate(field.id, { isNullable: !field.isNullable })}
                        title="Nullable"
                      >?</button>
                      <button
                        className={`flag-btn unique-btn ${field.isUnique ? 'active' : ''}`}
                        onClick={() => handleFieldUpdate(field.id, { isUnique: !field.isUnique })}
                        title="Unique"
                      >UQ</button>
                    </div>

                    <button
                      className="btn btn-danger btn-xs col-actions"
                      onClick={e => { e.stopPropagation(); handleRemoveField(field.id); }}
                    >✕</button>
                  </div>

                  {/* Expanded details */}
                  {selectedFieldId === field.id && (
                    <div className="field-row-details" onClick={e => e.stopPropagation()}>
                      <div className="form-group">
                        <label>欄位備註</label>
                        <textarea
                          value={field.notes || ''}
                          onChange={e => handleFieldUpdate(field.id, { notes: e.target.value })}
                          rows={2}
                          placeholder="欄位說明..."
                        />
                      </div>
                      <div className="form-row">
                        <div className="form-group">
                          <label>
                            <input
                              type="checkbox"
                              checked={field.hasDefault}
                              onChange={e => handleFieldUpdate(field.id, { hasDefault: e.target.checked })}
                            />
                            預設值
                          </label>
                          {field.hasDefault && (
                            <input
                              value={field.defaultValue}
                              onChange={e => handleFieldUpdate(field.id, { defaultValue: e.target.value })}
                              placeholder="DEFAULT value"
                            />
                          )}
                        </div>
                      </div>
                      {field.isForeignKey && (
                        <div className="form-row">
                          <div className="form-group">
                            <label>關聯 Entity</label>
                            <select
                              value={field.referencedEntity}
                              onChange={e => handleFieldUpdate(field.id, { referencedEntity: e.target.value })}
                            >
                              <option value="">-- 選擇 --</option>
                              {erEntities.filter(e => e.id !== entityId).map(e => (
                                <option key={e.id} value={e.id}>{e.name}</option>
                              ))}
                            </select>
                          </div>
                          {field.referencedEntity && (
                            <div className="form-group">
                              <label>關聯欄位</label>
                              <select
                                value={field.referencedField}
                                onChange={e => handleFieldUpdate(field.id, { referencedField: e.target.value })}
                              >
                                <option value="">-- 選擇 --</option>
                                {erEntities.find(e => e.id === field.referencedEntity)?.fields.map(f => (
                                  <option key={f.id} value={f.id}>{f.name}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-danger btn-sm" onClick={handleDeleteEntity}>🗑️ 刪除 Entity</button>
          <button className="btn btn-sm" onClick={onClose}>關閉</button>
        </div>
      </div>
    </div>
  );
}
