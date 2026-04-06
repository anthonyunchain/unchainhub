const statusStyles = {
  "Active":        { bg: "#E8F5EE", color: "#1A5C33" },
  "Inactive":      { bg: "var(--divider)", color: "var(--muted)" },
  "On hold":       { bg: "#FFF8E6", color: "#9A6700" },
  "Actif":        { bg: "#E8F5EE", color: "#1A5C33" },
  "Inactif":      { bg: "var(--divider)", color: "var(--muted)" },
  "En pause":     { bg: "#FFF8E6", color: "#9A6700" },
  "Signé":        { bg: "#E8F5EE", color: "#1A5C33" },
  "Perdu":        { bg: "#FEF0ED", color: "#C0391A" },
  "Brouillon":    { bg: "var(--divider)", color: "var(--muted)" },
  "Envoyé":       { bg: "#E6EEFF", color: "#2A69FF" },
  "Envoyée":      { bg: "#E6EEFF", color: "#2A69FF" },
  "Payée":        { bg: "#E8F5EE", color: "#1A5C33" },
  "Payé":         { bg: "#E8F5EE", color: "#1A5C33" },
  "En retard":    { bg: "#FEF0ED", color: "#C0391A" },
  "En attente":   { bg: "#FFF8E6", color: "#9A6700" },
  "Indisponible": { bg: "#FEF0ED", color: "#C0391A" },
  "Planifié":     { bg: "#E6EEFF", color: "#2A69FF" },
  "En cours":     { bg: "#FFF8E6", color: "#9A6700" },
  "Publié":       { bg: "#E8F5EE", color: "#1A5C33" },
  "Annulé":       { bg: "#FEF0ED", color: "#C0391A" },
};

export default function StatusBadge({ status }) {
  const s = statusStyles[status] || { bg: "var(--divider)", color: "var(--muted)" };
  return (
    <span style={{
      fontFamily: "'DM Mono', monospace",
      fontSize: '10px',
      fontWeight: 500,
      padding: '4px 10px',
      borderRadius: 100,
      backgroundColor: s.bg,
      color: s.color,
      display: 'inline-block',
      whiteSpace: 'nowrap',
      letterSpacing: '0.02em',
    }}>
      {status}
    </span>
  );
}