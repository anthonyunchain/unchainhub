export default function PageHeader({ title, subtitle, children }) {
  return (
    <div className={`flex mb-5 gap-3 ${children ? "flex-col sm:flex-row sm:items-center sm:justify-between" : "flex-row items-center"}`}>
      <div className="min-w-0">
        <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '20px', fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.3px' }}>{title}</h1>
        {subtitle && (
          <p style={{ fontFamily: "'DM Mono', monospace", fontSize: '10px', color: 'var(--muted)', marginTop: 4, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{subtitle}</p>
        )}
      </div>
      {children && <div className="flex items-center gap-2 flex-wrap shrink-0">{children}</div>}
    </div>
  );
}