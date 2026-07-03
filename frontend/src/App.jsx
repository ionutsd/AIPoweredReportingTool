import { useState } from 'react'
import FileUpload from './components/FileUpload.jsx'
import DataSourcePanel from './components/DataSourcePanel.jsx'
import InsightsPanel from './components/InsightsPanel.jsx'
import ChatPanel from './components/ChatPanel.jsx'
import ChartPanel from './components/ChartPanel.jsx'
import DashboardPanel from './components/DashboardPanel.jsx'
import BusinessInsightsPanel from './components/BusinessInsightsPanel.jsx'
import { uploadFile } from './api.js'

const SECTIONS = [
  { id: 'section-insights',  label: 'Insights'         },
  { id: 'section-ask',       label: 'Ask Data'         },
  { id: 'section-charts',    label: 'Charts'           },
  { id: 'section-dashboard', label: 'Dashboard'        },
  { id: 'section-business',  label: 'Business Insights'},
]

export default function App() {
  const [session, setSession]         = useState(null)
  const [insights, setInsights]       = useState(null)
  const [messages, setMessages]       = useState([])
  const [chartState, setChartState]   = useState(null)
  const [savedCharts, setSavedCharts] = useState([])
  const [loading, setLoading]         = useState(false)

  function resetPanels() {
    setInsights(null); setMessages([]); setChartState(null); setSavedCharts([])
  }

  function handleUploaded(data) { setSession(data); resetPanels() }
  function handleJoined(data)   { setSession(data); resetPanels() }

  function handleSendToChart(spec, data) {
    setChartState({ spec, data })
    scrollTo('section-charts')
  }

  function handleAddToDashboard(spec, data) {
    setSavedCharts(prev => [...prev, { id: `chart-${Date.now()}`, spec, data, title: spec.title || 'Chart' }])
  }

  function scrollTo(id) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="app-shell">

      {/* ── Top header ── */}
      <header className="appbar">
        {/* Logo */}
        <div className="appbar__logo">
          <div className="appbar__logo-mark">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect width="28" height="28" rx="7" fill="url(#lg)"/>
              <rect x="5" y="14" width="4" height="9" rx="1.5" fill="white" opacity="0.9"/>
              <rect x="12" y="9" width="4" height="14" rx="1.5" fill="white"/>
              <rect x="19" y="5" width="4" height="18" rx="1.5" fill="white" opacity="0.75"/>
              <defs>
                <linearGradient id="lg" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#6366f1"/>
                  <stop offset="100%" stopColor="#3b82f6"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div className="appbar__logo-text">
            <span className="appbar__logo-name">DataAI</span>
            <span className="appbar__logo-sub">Reporting Assistant</span>
          </div>
        </div>

        {/* Jump links — only when a file is loaded */}
        {session && (
          <nav className="appbar__nav">
            {SECTIONS.map(s => (
              <button key={s.id} className="appbar__nav-item" onClick={() => scrollTo(s.id)}>
                {s.label}
              </button>
            ))}
          </nav>
        )}

        {/* File info + upload */}
        <div className="appbar__right">
          {session && (
            <div className="appbar__file">
              <span className="appbar__file-icon">📄</span>
              <div>
                <div className="appbar__file-name">{session.fileName}</div>
                <div className="appbar__file-meta">
                  {session.profile.n_rows.toLocaleString()} rows · {session.profile.n_columns} cols
                </div>
              </div>
            </div>
          )}
          <label className={`appbar__upload-btn ${session ? 'appbar__upload-btn--secondary' : ''}`}>
            {loading && <span className="spinner spinner--dark" />}
            {session ? '↑ Change file' : '↑ Upload file'}
            <input
              type="file" accept=".csv,.xlsx,.xls" hidden
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                setLoading(true)
                try {
                  const data = await uploadFile(file)
                  handleUploaded({ ...data, fileName: file.name })
                } catch (err) { alert(err.message) }
                finally { setLoading(false); e.target.value = '' }
              }}
            />
          </label>
        </div>
      </header>

      {/* ── Main content ── */}
      <div className="main-area">
        <div className="content content--waterfall">
          {!session ? (
            <FileUpload onUploaded={handleUploaded} />
          ) : (
            <>
              <DataSourcePanel session={session} onJoined={handleJoined} />

              <section id="section-insights" className="waterfall-section">
                <div className="waterfall-section__head">
                  <span className="waterfall-section__num">1</span>
                  <h2 className="waterfall-section__title">Insights</h2>
                </div>
                <InsightsPanel sessionId={session.session_id} insights={insights} setInsights={setInsights} />
              </section>

              <section id="section-ask" className="waterfall-section">
                <div className="waterfall-section__head">
                  <span className="waterfall-section__num">2</span>
                  <h2 className="waterfall-section__title">Ask Data</h2>
                </div>
                <ChatPanel
                  sessionId={session.session_id} messages={messages} setMessages={setMessages}
                  onSendToChart={handleSendToChart} onAddToDashboard={handleAddToDashboard}
                />
              </section>

              <section id="section-charts" className="waterfall-section">
                <div className="waterfall-section__head">
                  <span className="waterfall-section__num">3</span>
                  <h2 className="waterfall-section__title">Charts</h2>
                </div>
                <ChartPanel
                  sessionId={session.session_id} externalChart={chartState}
                  onClearExternal={() => setChartState(null)} onAddToDashboard={handleAddToDashboard}
                />
              </section>

              <section id="section-dashboard" className="waterfall-section">
                <div className="waterfall-section__head">
                  <span className="waterfall-section__num">4</span>
                  <h2 className="waterfall-section__title">Dashboard</h2>
                </div>
                <DashboardPanel
                  charts={savedCharts} fileName={session.fileName}
                  onRemove={id => setSavedCharts(prev => prev.filter(c => c.id !== id))}
                  onReorder={setSavedCharts}
                />
              </section>

              <section id="section-business" className="waterfall-section" style={{ paddingBottom: 48 }}>
                <div className="waterfall-section__head">
                  <span className="waterfall-section__num">5</span>
                  <h2 className="waterfall-section__title">Business Insights</h2>
                </div>
                <BusinessInsightsPanel fileName={session.fileName} charts={savedCharts} />
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
