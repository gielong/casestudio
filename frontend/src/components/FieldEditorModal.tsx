import { useEffect, useMemo, useState } from 'react';
import { useStore, generateId } from '../store/useStore';
import type { ERField, ERRelationship } from '../api/client';

const DATA_TYPES = ['INT','BIGINT','SMALLINT','TINYINT','DECIMAL','NUMERIC','FLOAT','REAL','VARCHAR','NVARCHAR','CHAR','NCHAR','TEXT','NTEXT','DATE','TIME','DATETIME','DATETIME2','TIMESTAMP','BIT','BOOLEAN','BLOB','VARBINARY','IMAGE','UUID','UNIQUEIDENTIFIER','JSON','XML'];
const TYPE_HAS_LENGTH = ['VARCHAR','NVARCHAR','CHAR','NCHAR','VARBINARY'];
const TYPE_HAS_PRECISION = ['DECIMAL','NUMERIC'];
type Tab = 'fields'|'properties'|'indexes'|'alternate'|'constraints'|'relationships'|'comments'|'notes'|'ddl';

interface Props { entityId: string; onClose: () => void; }

export default function FieldEditorModal({ entityId, onClose }: Props) {
  const { erEntities, erRelationships, updateErEntity, removeErEntity, addFieldToEntity, updateFieldInEntity, removeFieldFromEntity, addErRelationship, updateErRelationship, removeErRelationship } = useStore();
  const entity = erEntities.find(e => e.id === entityId);
  const [tab,setTab]=useState<Tab>('fields');
  const [selectedFieldId,setSelectedFieldId]=useState<string|null>(null);
  const selectedField=entity?.fields.find(f=>f.id===selectedFieldId);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);
  const related=useMemo(()=>erRelationships.filter(r=>r.sourceEntityId===entityId||r.targetEntityId===entityId),[erRelationships,entityId]);
  if(!entity) return null;

  const addField=()=>{ const field:ERField={id:generateId('field'),name:`field_${entity.fields.length+1}`,columnName:`field_${entity.fields.length+1}`,dataType:'VARCHAR',length:255,precision:null,scale:null,isPrimaryKey:false,isForeignKey:false,isNullable:true,isUnique:false,hasDefault:false,defaultValue:'',referencedEntity:'',referencedField:'',notes:''}; addFieldToEntity(entityId,field); setSelectedFieldId(field.id); };
  const addInformative=()=>{ const target=erEntities.find(e=>e.id!==entityId); if(!target)return; const rel:ERRelationship={id:generateId('rel'),type:'informative',name:'Informative Relationship',sourceEntityId:entityId,targetEntityId:target.id,sourceFieldId:'',targetFieldId:'',sourceCardinality:'One',targetCardinality:'Many',sourceLabel:'',targetLabel:''}; addErRelationship(rel); setTab('relationships'); };
  const indexes=entity.indexes??[];
  const alternateKeys=entity.alternateKeys??[];
  const constraints=entity.checkConstraints??[];
  const addIndex=()=>updateErEntity(entityId,{indexes:[...indexes,{id:generateId('idx'),name:`IX_${entity.tableName||entity.name}_${indexes.length+1}`,fieldIds:[],isUnique:false}]});
  const addConstraint=()=>updateErEntity(entityId,{checkConstraints:[...constraints,{id:generateId('ck'),name:`CK_${entity.tableName||entity.name}_${constraints.length+1}`,expression:''}]});
  const addAlternateKey=()=>updateErEntity(entityId,{alternateKeys:[...alternateKeys,{id:generateId('ak'),name:`AK_${entity.tableName||entity.name}_${alternateKeys.length+1}`,fieldIds:[]}]});
  const ddl=`CREATE TABLE ${entity.tableName||entity.name} (\n${entity.fields.map(f=>`  ${f.columnName||f.name} ${f.dataType}${f.length?`(${f.length})`:''}${f.isNullable?'':' NOT NULL'}`).join(',\n')}\n);`;

  return <div className="modal-overlay entity-designer-overlay" onClick={onClose}>
    <div className="modal entity-designer" onClick={e=>e.stopPropagation()}>
      <div className="modal-header entity-designer-header"><span>🗃️ Entity 編輯器 - {entity.name}</span><button className="btn btn-xs" onClick={onClose}>✕</button></div>
      <div className="entity-name-row">
        <label>Entity Name（邏輯名稱）<input value={entity.name} onChange={e=>updateErEntity(entityId,{name:e.target.value})}/></label>
        <label>Table Name（資料表名稱）<input value={entity.tableName??entity.name} onChange={e=>updateErEntity(entityId,{tableName:e.target.value})}/></label>
      </div>
      <div className="entity-tabs">
        {([['fields',`欄位 (${entity.fields.length})`],['properties','屬性'],['indexes','索引'],['alternate','Alternate Keys'],['constraints','Constraints'],['relationships',`Relationship (${related.length})`],['comments','Comments'],['notes','Notes'],['ddl','DDL']] as [Tab,string][]).map(([id,label])=><button key={id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{label}</button>)}
      </div>
      <div className="entity-designer-body">
        {tab==='fields' && <>
          <div className="entity-toolbar"><button className="btn btn-primary btn-sm" onClick={addField}>＋ 新增欄位</button>{selectedField&&<button className="btn btn-danger btn-sm" onClick={()=>{removeFieldFromEntity(entityId,selectedField.id);setSelectedFieldId(null)}}>🗑️ 刪除</button>}</div>
          <div className="entity-grid-wrap"><table className="entity-grid"><thead><tr><th>Key</th><th>Name</th><th>Column Name</th><th>Datatype</th><th>Not Null</th><th>Unique</th><th>Default</th><th>Description</th></tr></thead><tbody>
          {entity.fields.map(f=><tr key={f.id} className={selectedFieldId===f.id?'selected':''} onClick={()=>setSelectedFieldId(f.id)}>
            <td>{f.isPrimaryKey?'🔑 PK':f.isForeignKey?'🔗 FK':''}</td><td>{f.name}</td><td>{f.columnName||f.name}</td><td>{f.dataType}{f.length?`(${f.length})`:''}</td><td>{!f.isNullable?'✓':''}</td><td>{f.isUnique?'✓':''}</td><td>{f.hasDefault?f.defaultValue:''}</td><td>{f.notes}</td>
          </tr>)}</tbody></table></div>
          {selectedField&&<div className="field-detail-drawer"><div className="field-detail-head"><strong>✏️ 編輯欄位：{selectedField.name}</strong><button className="btn btn-xs" onClick={()=>setSelectedFieldId(null)}>✕</button></div><div className="field-detail-panel">
            <label>Name<input value={selectedField.name} onChange={e=>updateFieldInEntity(entityId,selectedField.id,{name:e.target.value})}/></label>
            <label>Column Name<input value={selectedField.columnName??selectedField.name} onChange={e=>updateFieldInEntity(entityId,selectedField.id,{columnName:e.target.value})}/></label>
            <label>Datatype<select value={selectedField.dataType} onChange={e=>updateFieldInEntity(entityId,selectedField.id,{dataType:e.target.value})}>{DATA_TYPES.map(x=><option key={x}>{x}</option>)}</select></label>
            {TYPE_HAS_LENGTH.includes(selectedField.dataType)&&<label>Length<input type="number" value={selectedField.length??''} onChange={e=>updateFieldInEntity(entityId,selectedField.id,{length:e.target.value?+e.target.value:null})}/></label>}
            {TYPE_HAS_PRECISION.includes(selectedField.dataType)&&<><label>Precision<input type="number" value={selectedField.precision??''} onChange={e=>updateFieldInEntity(entityId,selectedField.id,{precision:e.target.value?+e.target.value:null})}/></label><label>Scale<input type="number" value={selectedField.scale??''} onChange={e=>updateFieldInEntity(entityId,selectedField.id,{scale:e.target.value?+e.target.value:null})}/></label></>}
            <label className="check"><input type="checkbox" checked={selectedField.isPrimaryKey} onChange={e=>updateFieldInEntity(entityId,selectedField.id,{isPrimaryKey:e.target.checked,isNullable:e.target.checked?false:selectedField.isNullable})}/>PK</label>
            <label className="check"><input type="checkbox" checked={!selectedField.isNullable} onChange={e=>updateFieldInEntity(entityId,selectedField.id,{isNullable:!e.target.checked})}/>Not Null</label>
            <label className="check"><input type="checkbox" checked={selectedField.isUnique} onChange={e=>updateFieldInEntity(entityId,selectedField.id,{isUnique:e.target.checked})}/>Unique</label>
            <label>Description<textarea value={selectedField.notes} onChange={e=>updateFieldInEntity(entityId,selectedField.id,{notes:e.target.value})}/></label>
          </div></div>}
        </>}
        {tab==='indexes'&&<><div className="entity-toolbar"><button className="btn btn-primary btn-sm" onClick={addIndex}>＋ 新增索引</button></div><div className="relationship-list">{indexes.map(idx=><div className="model-key-row" key={idx.id}><input value={idx.name} onChange={e=>updateErEntity(entityId,{indexes:indexes.map(x=>x.id===idx.id?{...x,name:e.target.value}:x)})}/><label className="check"><input type="checkbox" checked={idx.isUnique} onChange={e=>updateErEntity(entityId,{indexes:indexes.map(x=>x.id===idx.id?{...x,isUnique:e.target.checked}:x)})}/>Unique</label><select multiple value={idx.fieldIds} onChange={e=>updateErEntity(entityId,{indexes:indexes.map(x=>x.id===idx.id?{...x,fieldIds:Array.from(e.target.selectedOptions,o=>o.value)}:x)})}>{entity.fields.map(f=><option value={f.id} key={f.id}>{f.columnName||f.name}</option>)}</select><button className="btn btn-danger btn-xs" onClick={()=>updateErEntity(entityId,{indexes:indexes.filter(x=>x.id!==idx.id)})}>✕</button></div>)}</div></>}
        {tab==='alternate'&&<><div className="entity-toolbar"><button className="btn btn-primary btn-sm" onClick={addAlternateKey}>＋ 新增 Alternate Key</button></div><div className="relationship-list">{alternateKeys.map(ak=><div className="model-key-row" key={ak.id}><input value={ak.name} onChange={e=>updateErEntity(entityId,{alternateKeys:alternateKeys.map(x=>x.id===ak.id?{...x,name:e.target.value}:x)})}/><select multiple value={ak.fieldIds} onChange={e=>updateErEntity(entityId,{alternateKeys:alternateKeys.map(x=>x.id===ak.id?{...x,fieldIds:Array.from(e.target.selectedOptions,o=>o.value)}:x)})}>{entity.fields.map(f=><option value={f.id} key={f.id}>{f.columnName||f.name}</option>)}</select><button className="btn btn-danger btn-xs" onClick={()=>updateErEntity(entityId,{alternateKeys:alternateKeys.filter(x=>x.id!==ak.id)})}>✕</button></div>)}</div></>}
        {tab==='constraints'&&<><div className="entity-toolbar"><button className="btn btn-primary btn-sm" onClick={addConstraint}>＋ 新增 Check Constraint</button></div><div className="relationship-list">{constraints.map(ck=><div className="constraint-row" key={ck.id}><input value={ck.name} placeholder="Constraint Name" onChange={e=>updateErEntity(entityId,{checkConstraints:constraints.map(x=>x.id===ck.id?{...x,name:e.target.value}:x)})}/><input value={ck.expression} placeholder="例如：Price >= 0" onChange={e=>updateErEntity(entityId,{checkConstraints:constraints.map(x=>x.id===ck.id?{...x,expression:e.target.value}:x)})}/><button className="btn btn-danger btn-xs" onClick={()=>updateErEntity(entityId,{checkConstraints:constraints.filter(x=>x.id!==ck.id)})}>✕</button></div>)}</div></>}
        {tab==='relationships'&&<><div className="entity-toolbar"><button className="btn btn-primary btn-sm" onClick={addInformative}>＋ Informative Relationship</button></div><div className="relationship-list">{related.map(r=>{const outgoing=r.sourceEntityId===entityId; const other=erEntities.find(e=>e.id===(outgoing?r.targetEntityId:r.sourceEntityId));return <div className="relationship-row" key={r.id}><select value={r.type??'foreignKey'} onChange={e=>updateErRelationship(r.id,{type:e.target.value as 'foreignKey'|'informative'})}><option value="foreignKey">🔗 FK</option><option value="informative">┄ Informative</option></select><input value={r.name} onChange={e=>updateErRelationship(r.id,{name:e.target.value})}/><span>→</span><select value={other?.id??''} onChange={e=>updateErRelationship(r.id,outgoing?{targetEntityId:e.target.value}:{sourceEntityId:e.target.value})}>{erEntities.filter(e=>e.id!==entityId).map(e=><option value={e.id} key={e.id}>{e.name}</option>)}</select><button className="btn btn-danger btn-xs" onClick={()=>removeErRelationship(r.id)}>✕</button></div>})}</div></>}
        {tab==='notes'&&<textarea className="entity-notes" value={entity.notes} onChange={e=>updateErEntity(entityId,{notes:e.target.value})} placeholder="Entity Notes..." />}
        {tab==='comments'&&<textarea className="entity-notes" value={entity.notes} onChange={e=>updateErEntity(entityId,{notes:e.target.value})} placeholder="Comments..." />}
        {tab==='ddl'&&<pre className="ddl-preview">{ddl}</pre>}
        {(['properties'] as Tab[]).includes(tab)&&<div className="empty-tab">此分頁已預留，後續將加入完整資料庫屬性。</div>}
      </div>
      <div className="modal-footer"><button className="btn btn-danger btn-sm" onClick={()=>{if(confirm(`確定刪除 Entity「${entity.name}」？`)){removeErEntity(entityId);onClose();}}}>🗑️ 刪除 Entity</button><button className="btn btn-primary btn-sm" onClick={onClose}>完成</button></div>
    </div>
  </div>;
}
