// Вкладки-«таблетки»: items = [{ id, label, icon?, count? }]
export default function Tabs({ items, active, onChange, label = "Розділи" }) {
  return (
    <div className="tabs-bar" role="tablist" aria-label={label}>
      {items.map(({ id, label: text, icon: Icon, count }) => (
        <button key={id} type="button" role="tab" aria-selected={active === id} className={`tab-pill ${active === id ? "tab-pill-on" : ""}`}
          onClick={() => onChange(id)}>
          {Icon && <Icon size={16} />}
          {text}
          {count !== undefined && <span className="tab-count">{count}</span>}
        </button>
      ))}
    </div>
  );
}
