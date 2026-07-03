import { useState } from 'react'
import InlineChart from './InlineChart.jsx'

export default function DashboardPanel({ charts, fileName, onRemove, onReorder }) {
  const [dragIndex, setDragIndex] = useState(null)
  const [overIndex, setOverIndex] = useState(null)

  if (charts.length === 0) {
    return (
      <div className="dashboard-empty">
        <div className="dashboard-empty__icon">⊞</div>
        <div className="dashboard-empty__title">Your dashboard is empty</div>
        <p className="dashboard-empty__sub">
          Build charts in <strong>Charts</strong> or <strong>Ask Data</strong>, then
          click <strong>⊞ Add to Dashboard</strong> to collect them here.
        </p>
      </div>
    )
  }

  function handleDragStart(i) { setDragIndex(i) }
  function handleDragOver(e, i) { e.preventDefault(); setOverIndex(i) }
  function handleDrop(i) {
    if (dragIndex === null || dragIndex === i) { setDragIndex(null); setOverIndex(null); return }
    const reordered = [...charts]
    const [moved] = reordered.splice(dragIndex, 1)
    reordered.splice(i, 0, moved)
    onReorder(reordered)
    setDragIndex(null)
    setOverIndex(null)
  }

  function handleExport() { window.print() }

  const now = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div>
      <div className="print-header">
        <div className="print-header__title">📊 DataAI — Analysis Report</div>
        <div className="print-header__meta">
          File: {fileName} · Generated: {now} · {charts.length} visual{charts.length !== 1 ? 's' : ''}
        </div>
      </div>

      <div className="dashboard-header no-print">
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>
            {charts.length} visual{charts.length !== 1 ? 's' : ''} collected
          </div>
          <div className="dashboard-header__meta">From: {fileName} · {now} · drag cards to reorder</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn--ghost btn--sm" onClick={handleExport}>🖨 Export / Print</button>
          <button
            className="btn btn--danger btn--sm"
            onClick={() => { if (window.confirm('Clear all charts?')) charts.forEach(c => onRemove(c.id)) }}
          >
            Clear all
          </button>
        </div>
      </div>

      <div className="dashboard-grid">
        {charts.map((chart, i) => (
          <div
            key={chart.id}
            className={`dashboard-card ${dragIndex === i ? 'dashboard-card--dragging' : ''} ${overIndex === i && dragIndex !== i ? 'dashboard-card--over' : ''}`}
            draggable
            onDragStart={() => handleDragStart(i)}
            onDragOver={e => handleDragOver(e, i)}
            onDrop={() => handleDrop(i)}
            onDragEnd={() => { setDragIndex(null); setOverIndex(null) }}
          >
            <div className="dashboard-card__header">
              <span className="dashboard-card__drag no-print" title="Drag to reorder">⠿</span>
              <span className="dashboard-card__title">{chart.title}</span>
              <button className="btn btn--danger btn--sm no-print" onClick={() => onRemove(chart.id)} title="Remove">✕</button>
            </div>
            {chart.spec?.reasoning && (
              <p style={{ fontSize: 11, color: 'var(--muted)', margin: 0 }}>{chart.spec.reasoning}</p>
            )}
            <InlineChart spec={chart.spec} data={chart.data} height={220} />
          </div>
        ))}
      </div>
    </div>
  )
}
