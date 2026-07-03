import { useState } from 'react'
import { getInsights } from '../api.js'

const TYPE_ICONS = {
  'trend analysis': '📈', 'segmentation': '🔍', 'correlation': '🔗',
  'distribution': '📊', 'outlier detection': '⚠️', 'time series': '📅',
  'ranking': '🏆', 'comparison': '⚖️',
}

export default function InsightsPanel({ sessionId, insights, setInsights }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleGenerate() {
    setLoading(true)
    setError(null)
    try {
      const data = await getInsights(sessionId)
      setInsights(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="insights-panel">
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: insights ? 16 : 0 }}>
          <div>
            <div className="card__label">AI Analysis</div>
            {!insights && !loading && (
              <p style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14 }}>
                Click below to let the AI analyse your dataset and surface what matters.
              </p>
            )}
          </div>
          <button className="btn btn--primary" onClick={handleGenerate} disabled={loading}>
            {loading && <span className="spinner" />}
            {loading ? 'Analysing…' : insights ? 'Regenerate' : 'Generate insights'}
          </button>
        </div>

        {error && <p className="error-msg">⚠ {error}</p>}

        {insights && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {insights.insights.map((point, i) => (
              <div key={i} className="insight-item">
                <span className="insight-item__num">0{i + 1}</span>
                <span>{point}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {insights?.next_steps?.length > 0 && (
        <div className="card">
          <div className="card__label">Recommended next steps</div>
          <div className="next-steps">
            {insights.next_steps.map((step, i) => (
              <div key={i} className="next-step">
                <div className="next-step__header">
                  <span>{TYPE_ICONS[step.analysis_type] || '🔎'}</span>
                  <span className="next-step__title">{step.title}</span>
                  <span className="next-step__tag">{step.analysis_type}</span>
                </div>
                <p className="next-step__desc">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
