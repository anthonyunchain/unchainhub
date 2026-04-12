export default function PageHeader({ title, subtitle, children }) {
  return (
    <div className="flex flex-row items-center justify-between mb-5 gap-3">
      <div>
        <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.3px' }}>{title}</h1>
        {subtitle && (
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--muted)', marginTop: 4, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{subtitle}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
    </div>
  );
}