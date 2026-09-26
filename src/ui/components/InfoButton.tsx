import { useState, type ReactNode } from 'react';

/** Botón "i" que despliega una explicación debajo del título. */
export function InfoTitle({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <h4 className="info-title">
        {title}
        <button
          className={`info-btn ${open ? 'on' : ''}`}
          aria-expanded={open}
          aria-label={`Cómo se lee: ${title}`}
          title="Cómo se lee"
          onClick={() => setOpen(!open)}
        >
          i
        </button>
      </h4>
      {open && <div className="info-panel">{children}</div>}
    </>
  );
}
