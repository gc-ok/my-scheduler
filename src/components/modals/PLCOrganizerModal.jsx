// src/components/modals/PLCOrganizerModal.jsx

export const PLCOrganizerModal = ({ teachers, periods, plcGroups, onClose, onSave }) => {
  const [groups, setGroups] = useState(plcGroups || []);

  const addGroup = () => {
    setGroups([...groups, { id: Date.now(), period: periods[0].id, teacherIds: [] }]);
  };

  const updateGroup = (id, field, value) => {
    setGroups(groups.map(g => g.id === id ? { ...g, [field]: value } : g));
  };

  return (
    <div style={modalOverlayStyle}>
      <div style={{ ...modalContentStyle, width: 800 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <h2>Organize PLC Groups</h2>
          <button onClick={addGroup} style={btnStyle(COLORS.success, COLORS.white)}>+ New PLC Group</button>
        </div>

        <div style={{ maxHeight: 500, overflowY: 'auto', marginTop: 20 }}>
          {groups.map(group => (
            <div key={group.id} style={{ border: `1px solid ${COLORS.lightGray}`, padding: 15, borderRadius: 10, marginBottom: 15 }}>
              <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginBottom: 10 }}>
                <input 
                  placeholder="Group Name (e.g. 9th Algebra)" 
                  value={group.name} 
                  onChange={e => updateGroup(group.id, 'name', e.target.value)}
                  style={inputStyle} 
                />
                <select 
                  value={group.period} 
                  onChange={e => updateGroup(group.id, 'period', parseInt(e.target.value))}
                  style={inputStyle}
                >
                  {periods.map(p => <option key={p.id} value={p.id}>Meet during {p.label}</option>)}
                </select>
              </div>
              
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {teachers.map(t => (
                  <div 
                    key={t.id}
                    onClick={() => {
                      const newIds = group.teacherIds.includes(t.id)
                        ? group.teacherIds.filter(id => id !== t.id)
                        : [...group.teacherIds, t.id];
                      updateGroup(group.id, 'teacherIds', newIds);
                    }}
                    style={{
                      fontSize: 11, padding: '4px 8px', borderRadius: 4, cursor: 'pointer',
                      background: group.teacherIds.includes(t.id) ? COLORS.primary : COLORS.offWhite,
                      color: group.teacherIds.includes(t.id) ? 'white' : COLORS.text
                    }}
                  >
                    {t.name}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={btnStyle(COLORS.lightGray, COLORS.text)}>Cancel</button>
          <button onClick={() => onSave(groups)} style={btnStyle(COLORS.primary, COLORS.white)}>Apply & Regenerate Schedule</button>
        </div>
      </div>
    </div>
  );
};