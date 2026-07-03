import { useState, useRef, useEffect } from 'react'
import { askQuestion, chartFromResult } from '../api.js'
import InlineChart from './InlineChart.jsx'

const EXAMPLES = [
  'What is the total sales by category?',
  'Show me the top 10 products by revenue',
  'What is the monthly trend for quantity sold?',
]

function isChartable(result) {
  if (Array.isArray(result) && result.length > 0 && typeof result[0] === 'object') return true
  if (result && typeof result === 'object' && !Array.isArray(result) && Object.keys(result).length > 0) return true
  return false
}

function normalizeToArray(result) {
  if (Array.isArray(result)) return result
  return Object.entries(result).map(([label, value]) => ({ label, value }))
}

function ResultBlock({ message, onSendToChart, onAddToDashboard }) {
  const [suggestions, setSuggestions]   = useState(null)
  const [selectedChart, setSelectedChart] = useState(null)
  const [loadingViz, setLoadingViz]     = useState(false)
  const [vizError, setVizError]         = useState(null)

  async function handleVisualize() {
    setLoadingViz(true)
    setVizError(null)
    try {
      const normalized = normalizeToArray(message.result)
      const data = await chartFromResult(message.question, normalized)
      setSuggestions({ options: data.suggestions, data: normalized })
    } catch (err) {
      setVizError(err.message)
    } finally {
      setLoadingViz(false)
    }
  }

  function handlePickChart(suggestion) {
    setSelectedChart({ spec: suggestion, data: suggestions.data })
  }

  return (
    <div className="result-block">
      <pre className="result-block__data">
        {JSON.stringify(message.result, null, 2)}
      </pre>

      {isChartable(message.result) && !suggestions && !selectedChart && (
        <div className="result-block__actions">
          <button className="btn btn--secondary btn--sm" onClick={handleVisualize} disabled={loadingViz}>
            {loadingViz ? <span className="spinner spinner--dark" /> : '📊'}
            {loadingViz ? 'Thinking…' : 'Visualize this'}
          </button>
        </div>
      )}

      {vizError && <p className="error-msg">⚠ {vizError}</p>}

      {suggestions && !selectedChart && (
        <div className="chart-suggestions">
          <div className="chart-suggestions__label">Choose a chart type</div>
          {suggestions.options.map((s, i) => (
            <button key={i} className="chart-suggestion-opt" onClick={() => handlePickChart(s)}>
              <span className="chart-suggestion-opt__type">{s.chart_type}</span>
              <span className="chart-suggestion-opt__reason">{s.reasoning}</span>
            </button>
          ))}
        </div>
      )}

      {selectedChart && (
        <div className="inline-chart">
          <div className="inline-chart__header">
            <span className="inline-chart__title">{selectedChart.spec.title}</span>
          </div>
          <InlineChart spec={selectedChart.spec} data={selectedChart.data} height={240} />
          <div className="inline-chart__actions">
            <button className="btn btn--ghost btn--sm"
              onClick={() => onSendToChart(selectedChart.spec, selectedChart.data)}>
              ↗ Open in Charts
            </button>
            <button className="btn btn--ghost btn--sm"
              onClick={() => onAddToDashboard(selectedChart.spec, selectedChart.data)}>
              ⊞ Add to Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ChatPanel({ sessionId, messages, setMessages, onSendToChart, onAddToDashboard }) {
  const [question, setQuestion] = useState('')
  const [loading, setLoading]   = useState(false)
  const messagesRef = useRef(null)

  // Scroll only the chat container — never the whole page
  useEffect(() => {
    const el = messagesRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages, loading])

  async function handleSubmit(e) {
    e?.preventDefault()
    if (!question.trim()) return
    const q = question
    setQuestion('')
    setMessages(m => [...m, { role: 'user', text: q }])
    setLoading(true)
    try {
      const data = await askQuestion(sessionId, q)
      if (data.error) {
        setMessages(m => [...m, { role: 'assistant', text: `Couldn't compute that: ${data.error}`, result: null, question: q }])
      } else {
        setMessages(m => [...m, { role: 'assistant', text: null, result: data.result, question: q }])
      }
    } catch (err) {
      setMessages(m => [...m, { role: 'assistant', text: `Error: ${err.message}`, result: null }])
    } finally {
      setLoading(false)
    }
  }

  function handleExample(ex) {
    setQuestion(ex)
  }

  return (
    <div className="chat-panel">
      <div className="chat-messages" ref={messagesRef}>
        {messages.length === 0 && (
          <div className="chat-hint">
            <div className="chat-hint__title">Ask anything about your data</div>
            <p style={{ fontSize: 12 }}>Try one of these to get started:</p>
            <div className="chat-hint__examples">
              {EXAMPLES.map((ex, i) => (
                <button key={i} className="chat-hint__example" onClick={() => handleExample(ex)}>
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`chat-msg chat-msg--${m.role}`}>
            <div className="chat-msg__label">{m.role === 'user' ? 'You' : 'DataAI'}</div>
            <div className="chat-msg__bubble">
              {m.role === 'user' && <p style={{ margin: 0 }}>{m.text}</p>}
              {m.role === 'assistant' && m.text && <p style={{ margin: 0 }}>{m.text}</p>}
              {m.role === 'assistant' && m.result !== null && m.result !== undefined && (
                <ResultBlock
                  message={m}
                  onSendToChart={onSendToChart}
                  onAddToDashboard={onAddToDashboard}
                />
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="chat-msg chat-msg--assistant">
            <div className="chat-msg__label">DataAI</div>
            <div className="chat-msg__bubble">
              <span className="spinner spinner--dark" /> Thinking…
            </div>
          </div>
        )}
      </div>

      <form className="chat-form" onSubmit={handleSubmit}>
        <input
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder="Ask a question about your data…"
        />
        <button className="btn btn--primary" type="submit" disabled={loading}>
          {loading ? <span className="spinner" /> : 'Ask'}
        </button>
      </form>
    </div>
  )
}
