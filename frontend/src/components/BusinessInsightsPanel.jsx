import { useState } from 'react'
import { generateBusinessInsights } from '../api.js'

const IMPACT_STYLE = {
  high: { bg: '#fef2f2', color: '#991b1b', label: 'High impact' },
  medium: { bg: '#fffbeb', color: '#92400e', label: 'Medium impact' },
  low: { bg: '#f0fdf4', color: '#166534', label: 'Low impact' },
}

export default function BusinessInsightsPanel({ fileName, charts }) {
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    try {
      const payload = charts.map(c => ({ title: c.title, spec: c.spec, data: c.data }))
      const data = await generateBusinessInsights(fileName, payload)
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (charts.length === 0) {
    return (
      <div className="dashboard-empty">
        <div className="dashboard-empty__icon">💡</div>
        <div className="dashboard-empty__title">Add charts to your dashboard first</div>
        <p className="dashboard-empty__sub">
          Once you've collected a few charts in step ④, come back here and the AI
          will read them together and surface business-level takeaways.
        </p>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div className="card__label">Strategic read</div>
            {!result && !loading && (
              <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
                Analyse the {charts.length} chart{charts.length !== 1 ? 's' : ''} on your dashboard as a whole —
                trends, risks, and what to do next.
              </p>
            )}
          </div>
          <button className="btn btn--primary" onClick={handleGenerate} disabled={loading}>
            {loading && <span className="spinner" />}
            {loading ? 'Analysing…' : result ? 'Regenerate' : 'Generate business insights'}
          </button>
        </div>

        {error && <p className="error-msg" style={{ marginTop: 10 }}>⚠ {error}</p>}

        {result?.summary && (
          <div className="biz-summary">{result.summary}</div>
        )}
      </div>

      {result && (
        <>
          {result.trends?.length > 0 && (
            <div className="card">
              <div className="card__label">📈 Trends across your dashboard</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {result.trends.map((t, i) => (
                  <div key={i} className="insight-item">
                    <span className="insight-item__num">0{i + 1}</span>
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.risks?.length > 0 && (
            <div className="card">
              <div className="card__label">⚠ Risks to watch</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {result.risks.map((r, i) => (
                  <div key={i} className="biz-risk">⚠ {r}</div>
                ))}
              </div>
            </div>
          )}

          {result.recommendations?.length > 0 && (
            <div className="card">
              <div className="card__label">✦ Recommended actions</div>
              <div className="next-steps">
                {result.recommendations.map((rec, i) => {
                  const style = IMPACT_STYLE[rec.impact] || IMPACT_STYLE.medium
                  return (
                    <div key={i} className="next-step">
                      <div className="next-step__header">
                        <span className="next-step__title">{rec.action}</span>
                        <span className="next-step__tag" style={{ background: style.bg, color: style.color }}>
                          {style.label}
                        </span>
                      </div>
                      <p className="next-step__desc">{rec.rationale}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
