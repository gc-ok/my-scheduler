// Create src/components/modals/TeacherAvailabilityModal.jsx

export const TeacherAvailabilityModal = ({ teacher, schedule, onClose, onSave }) => {
  // Initialize with currently blocked periods
  const [blocked, setBlocked] = useState(teacher.blockedPeriods || []);

  const togglePeriod = (pid) => {
    setBlocked(prev => prev.includes(pid) 
      ? prev.filter(p => p !== pid) 
      : [...prev, pid]
    );
  };

  return (
    <div style={modalOverlayStyle}>
      <div style={modalContentStyle}>
        <h3>Availability for {teacher.name}</h3>
        <p style={{fontSize: 12, color: '#666'}}>Select periods where this teacher is NOT available to teach (Plan, PLC, or Off-campus).</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, margin: '20px 0' }}>
          {schedule.periodList.map(p => (
            <button 
              key={p.id}
              onClick={() => togglePeriod(p.id)}
              style={{
                padding: '10px',
                borderRadius: 8,
                border: `2px solid ${blocked.includes(p.id) ? COLORS.danger : COLORS.success}`,
                background: blocked.includes(p.id) ? `${COLORS.danger}15` : 'white',
                cursor: 'pointer'
              }}
            >
              {p.label}
              <div style={{fontSize: 9}}>{blocked.includes(p.id) ? '🚫 BLOCKED' : '✅ TEACH'}</div>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} style={btnStyle(COLORS.lightGray, COLORS.text)}>Cancel</button>
          <button onClick={() => onSave(blocked)} style={btnStyle(COLORS.primary, COLORS.white)}>Save Availability</button>
        </div>
      </div>
    </div>
  );
};