'use client'

import { X, ExternalLink } from 'lucide-react'

export interface DocPreview {
  url: string
  type: 'image' | 'pdf'
  label?: string
}

// Renders the document directly in the page instead of opening a new tab -
// a new tab depends on window.open succeeding, which browsers silently
// block once it happens after an await (see lib/openDocTab.ts for the bug
// that caused), and some in-app browsers (WhatsApp, Instagram) block
// window.open outright with no setting to allow it. An inline preview has
// no such dependency: the image/PDF just renders. "Open in new tab" is
// still offered as a real <a> the admin clicks themselves, which is never
// subject to popup blocking since it's a direct DOM click, not a JS call.
export function DocViewerModal({ doc, onClose }: { doc: DocPreview | null; onClose: () => void }) {
  if (!doc) return null
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 200, display: 'flex', flexDirection: 'column' }} onClick={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: 'rgba(13,21,38,0.97)', borderBottom: '1px solid rgba(255,255,255,0.1)' }} onClick={e => e.stopPropagation()}>
        <span style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>{doc.label || 'Document'}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <a
            href={doc.url} target="_blank" rel="noopener noreferrer"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: 600, textDecoration: 'none' }}
          >
            <ExternalLink size={13} /> Open in new tab
          </a>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.7)', padding: 4, display: 'flex' }}>
            <X size={20} />
          </button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={e => e.stopPropagation()}>
        {doc.type === 'image' ? (
          <img src={doc.url} alt={doc.label || 'Document'} style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 8, boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }} />
        ) : (
          <iframe src={doc.url} title={doc.label || 'Document'} style={{ width: '100%', height: '100%', border: 'none', borderRadius: 8, background: '#fff' }} />
        )}
      </div>
    </div>
  )
}
