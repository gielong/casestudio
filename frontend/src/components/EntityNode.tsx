import { memo, useState } from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import type { EREntity, ERField } from '../api/client';

function getTypeColor(field: ERField): string {
  if (field.isPrimaryKey) return '#f38ba8';
  if (field.isForeignKey) return '#89b4fa';
  if (!field.isNullable) return '#a6e3a1';
  return '#cdd6f4';
}

function getConstraints(field: ERField): string {
  const parts: string[] = [];
  if (field.isPrimaryKey) parts.push('PK');
  if (field.isForeignKey) parts.push('FK');
  if (field.isUnique) parts.push('UQ');
  if (!field.isNullable) parts.push('NN');
  if (field.hasDefault) parts.push('DEF');
  return parts.join(', ');
}

function formatDataType(field: ERField): string {
  if (field.length) return `${field.dataType}(${field.length})`;
  if (field.precision !== null) {
    return field.scale !== null ? `${field.dataType}(${field.precision},${field.scale})` : `${field.dataType}(${field.precision})`;
  }
  return field.dataType;
}

const FieldRow = memo(function FieldRow({ field }: { field: ERField }) {
  const [showTooltip, setShowTooltip] = useState(false);
  
  const hasTooltip = field.notes || field.defaultValue || field.isForeignKey;

  return (
    <div 
      className="entity-field"
      onMouseEnter={() => hasTooltip && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
      style={{ position: 'relative' }}
    >
      <Handle type="target" position={Position.Left} id={`field-${field.id}`} className="field-handle" />
      <div className="field-left">
        <span className="field-icon">
          {field.isPrimaryKey ? '🔑' : field.isForeignKey ? '🔗' : '·'}
        </span>
        <span className="field-name" style={{ color: getTypeColor(field) }}>
          {field.name}
        </span>
      </div>
      <div className="field-right">
        <span className="field-type">{formatDataType(field)}</span>
        <span className="field-constraints">{getConstraints(field)}</span>
      </div>
      <Handle type="source" position={Position.Right} id={`field-${field.id}`} className="field-handle" />
      
      {/* Field Tooltip */}
      {showTooltip && hasTooltip && (
        <div className="field-tooltip">
          {field.notes && <div className="tooltip-row"><span className="tooltip-label">備註：</span>{field.notes}</div>}
          {field.defaultValue && <div className="tooltip-row"><span className="tooltip-label">預設值：</span>{field.defaultValue}</div>}
          {field.isForeignKey && <div className="tooltip-row"><span className="tooltip-label">FK：</span>{field.referencedEntity}.{field.referencedField}</div>}
        </div>
      )}
    </div>
  );
});

function EntityNode({ data, selected }: NodeProps<{ entity: EREntity }>) {
  const { entity } = data;
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className={`entity-node${selected ? ' entity-selected' : ''}`}>
      {/* Entity Header with tooltip */}
      <div 
        className="entity-header"
        onMouseEnter={() => entity.notes && setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        style={{ cursor: entity.notes ? 'help' : 'default' }}
      >
        {entity.name}
        {showTooltip && entity.notes && (
          <div className="entity-tooltip">
            {entity.notes}
          </div>
        )}
      </div>
      
      {/* Fields */}
      <div className="entity-fields">
        {entity.fields.map((field) => (
          <FieldRow key={field.id} field={field} />
        ))}
      </div>
    </div>
  );
}

export default memo(EntityNode);
