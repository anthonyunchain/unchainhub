import { Inbox } from "lucide-react";

export default function EmptyState({
  icon: Icon = Inbox,
  title = "Nothing here yet",
  description,
  action,
  className = "",
}) {
  return (
    <div
      role="status"
      className={`flex flex-col items-center justify-center text-center py-14 px-6 rounded-2xl border ${className}`}
      style={{
        background: 'var(--card)',
        borderColor: 'var(--divider)',
        color: 'var(--ink)',
      }}
    >
      <div
        aria-hidden="true"
        className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
        style={{ background: 'var(--brand-muted)', color: 'var(--brand)' }}
      >
        <Icon className="w-6 h-6" />
      </div>
      <p className="text-h3" style={{ marginBottom: description ? 6 : 0 }}>{title}</p>
      {description && (
        <p className="text-body-sm" style={{ maxWidth: 320 }}>{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
