import { useState, useEffect } from 'react'
import { suggestChart } from '../api.js'
import InlineChart from './InlineChart.jsx'

export default function ChartPanel({ sessionId, externalChart, onClearExternal, onAddToDashboard }) {
  const [description, setDescription] = useState('')
  const [result, setResult]           = useState(null)
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState(null)

  useEffect(() => {
    if (externalChart) {
      setResult({ spec: externalChart.spec, data: externalChart.data })
      setError(null)
    }
  }, [externalChart])

  async function handleSubmit(e) {
    e.preventDefault()
    if (!description.trim()) return
    setLoading(true)
    setError(null)
    onClearExternal()
    try {
      const data = await suggestChart(sessionId, description)
      setResult(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="charts-panel">
      <div className="card">
        <div className="card__label">Describe a chart</div>
        <form className="charts-form" onSubmit={handleSubmit}>
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="e.g. sales over time by region, top 10 products by revenue…"
          />
          <button className="btn btn--primary" type="submit" disabled={loading}>
            {loading ? <span className="spinner" /> : '✦'}
            {loading ? 'Building…' : 'Build chart'}
          </button>
        </form>
        {error && <p className="error-msg" style={{ marginTop: 10 }}>⚠ {error}</p>}
      </div>

      {result && (
        <div className="card">
          {externalChart && (
            <div className="charts-from-chat">
              ↙ Sent from Ask Data
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div className="card__label">Result</div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{result.spec?.title}</div>
              {result.spec?.reasoning && (
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>{result.spec.reasoning}</div>
              )}
            </div>
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => onAddToDashboard(result.spec, result.data)}
            >
              ⊞ Add to Dashboard
            </button>
          </div>
          <InlineChart spec={result.spec} data={result.data} height={300} />
        </div>
      )}
    </div>
  )
}
