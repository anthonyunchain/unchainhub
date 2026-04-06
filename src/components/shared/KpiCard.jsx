export default function KpiCard({ title, value, subtitle, delta, icon: Icon, tint = "blue" }) {
  const tints = {
    blue:   { bg: 'var(--card-blue)',   valueColor: 'var(--brand)' },
    purple: { bg: 'var(--card-purple)', valueColor: 'var(--purple)' },
    green:  { bg: 'var(--card-green)',  valueColor: 'var(--success)' },
    amber:  { bg: 'var(--card-amber)',  valueColor: 'var(--warning)' },
    white:  { bg: 'var(--card)',        valueColor: 'var(--ink)' },
  };
  const t = tints[tint] || tints.blue;

  return (
    <div
      style={{
        background: t.bg,
        borderRadius: 'var(--card-radius)',
        boxShadow: 'var(--card-shadow)',
        padding: '20px',
        border: 'none',
        transition: 'box-shadow 200ms ease, transform 200ms ease',
        cursor: 'default',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 12,
        height: '100%',
      }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--card-shadow-hover)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--card-shadow)'; e.currentTarget.style.transform = 'translateY(0)'; }}
    >
      <div className="flex items-start justify-between">
        <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', fontWeight: 500, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.12em' }}>{title}</p>
        {Icon && (
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--brand-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon style={{ width: 15, height: 15, color: 'var(--brand)' }} />
          </div>
        )}
      </div>
      <div>
        <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '34px', fontWeight: 800, color: t.valueColor, letterSpacing: '-2px', lineHeight: 1.05 }}>{value}</p>
        {subtitle && <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--muted)', marginTop: 4 }}>{subtitle}</p>}
      </div>
      {delta && (
        <span style={{
          fontFamily: "'DM Mono', monospace", fontSize: '11px',
          padding: '4px 10px', borderRadius: 100,
          display: 'inline-flex', alignItems: 'center', gap: 4,
          background: delta.startsWith('+') ? '#E8F5EE' : '#FEF0ED',
          color: delta.startsWith('+') ? 'var(--success-text, #1A5C33)' : 'var(--urgent-text, #C0391A)',
          alignSelf: 'flex-start',
        }}>{delta}</span>
      )}
    </div>
  );
}