const config = {
  ALTA:  { label: 'Alta',  bg: '#D4EDDA', color: '#155724' },
  MEDIA: { label: 'Media', bg: '#FFF3CD', color: '#856404' },
  BAJA:  { label: 'Baja',  bg: '#F8D7DA', color: '#721C24' },
} as const;

export function ProbabilidadBadge({ valor }: { valor: 'ALTA' | 'MEDIA' | 'BAJA' }) {
  const c = config[valor] ?? config.MEDIA;
  return (
    <span
      style={{ background: c.bg, color: c.color, padding: '2px 10px', borderRadius: '12px', fontSize: '13px', fontWeight: 600 }}
    >
      {c.label}
    </span>
  );
}
