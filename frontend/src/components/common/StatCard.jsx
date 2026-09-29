// Картка показника: кольорова піктограма, значення, підпис і необов’язкова примітка
export default function StatCard({ label, value, icon: Icon, tone = "indigo", note }) {
  return (
    <div className="stat">
      {Icon && (
        <span className={`stat-icon tone-${tone}`}>
          <Icon size={22} />
        </span>
      )}
      <div className="stat-body">
        <span className="stat-label">{label}</span>
        <span className="stat-value">{value}</span>
        {note && <span className="stat-note">{note}</span>}
      </div>
    </div>
  );
}
