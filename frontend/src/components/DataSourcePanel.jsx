import { useState } from 'react'
import { uploadFile, suggestJoinKey, joinDatasets } from '../api.js'

const JOIN_TYPES = [
  { id: 'left',  label: 'Left',  icon: '◐' },
  { id: 'inner', label: 'Inner', icon: '◉' },
  { id: 'right', label: 'Right', icon: '◑' },
]

const DTYPE_COLORS = {
  int:      { bg: '#eff6ff', color: '#1d4ed8' },
  float:    { bg: '#f0fdf4', color: '#166534' },
  text:     { bg: '#fdf4ff', color: '#7e22ce' },
  datetime: { bg: '#fff7ed', color: '#c2410c' },
}

function DTypeBadge({ dtype }) {
  const style = DTYPE_COLORS[dtype] || { bg: '#f1f5f9', color: '#475569' }
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '1px 5px',
      borderRadius: 4, background: style.bg, color: style.color,
      marginLeft: 4, verticalAlign: 'middle',
    }}>
      {dtype}
    </span>
  )
}

function getDtype(profile, colName) {
  const col = profile?.columns?.find(c => c.name === colName)
  if (!col) return null
  if (col.dtype.startsWith('int')) return 'int'
  if (col.dtype.startsWith('float')) return 'float'
  if (col.dtype.startsWith('datetime')) return 'datetime'
  return 'text'
}

export default function DataSourcePanel({ session, onJoined }) {
  const [open, setOpen]               = useState(!session.sources)
  const [secondFile, setSecondFile]   = useState(null)
  const [joinType, setJoinType]       = useState('left')
  const [key1, setKey1]               = useState('')
  const [key2, setKey2]               = useState('')
  const [coerceTo, setCoerceTo]       = useState(null)
  const [hint, setHint]               = useState(null)
  const [loadingUpload, setLoadingUpload] = useState(false)
  const [loadingHint, setLoadingHint]     = useState(false)
  const [loadingJoin, setLoadingJoin]     = useState(false)
  const [error, setError]             = useState(null)

  async function handleSecondUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoadingUpload(true)
    setError(null)
    try {
      const data = await uploadFile(file)
      setSecondFile({ ...data, fileName: file.name })
      setHint(null); setKey1(''); setKey2(''); setCoerceTo(null)
    } catch (err) { setError(err.message) }
    finally { setLoadingUpload(false); e.target.value = '' }
  }

  async function handleAiSuggest() {
    setLoadingHint(true); setError(null)
    try {
      const data = await suggestJoinKey(session.session_id, secondFile.session_id)
      setHint(data)
      if (data.suggested_key_1) setKey1(data.suggested_key_1)
      if (data.suggested_key_2) setKey2(data.suggested_key_2)
    } catch (err) { setError(err.message) }
    finally { setLoadingHint(false) }
  }

  async function handleApplyJoin() {
    if (!key1 || !key2) return
    setLoadingJoin(true); setError(null)
    try {
      const data = await joinDatasets(
        session.session_id, secondFile.session_id,
        key1, key2, joinType, coerceTo
      )
      onJoined({ ...data, fileName: `${session.fileName} ⋈ ${secondFile.fileName}`, sources: [session.fileName, secondFile.fileName] })
      setSecondFile(null)
    } catch (err) { setError(err.message) }
    finally { setLoadingJoin(false) }
  }

  const keys1 = session.profile.columns.map(c => c.name)
  const keys2 = secondFile ? secondFile.profile.columns.map(c => c.name) : []

  // Detect type mismatch between selected keys
  const dtype1 = key1 ? getDtype(session.profile, key1) : null
  const dtype2 = key2 ? getDtype(secondFile?.profile, key2) : null
  const hasMismatch = dtype1 && dtype2 && dtype1 !== dtype2

  return (
    <div className="card" id="section-source">
      <button className="source-toggle" onClick={() => setOpen(o => !o)}>
        <span className="source-toggle__dot" />
        <span className="card__label" style={{ marginBottom: 0 }}>Data Sources</span>
        <span className="source-toggle__count">{session.sources ? '2 joined' : '1 file'}</span>
        <span className="source-toggle__chevron">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="source-body">
          {/* File 1 */}
          <div className="source-node">
            <span className="source-node__dot source-node__dot--a" />
            <div>
              <div className="source-node__name">{session.sources ? session.sources[0] : session.fileName}</div>
              <div className="source-node__meta">{session.profile.n_rows.toLocaleString()} rows · {session.profile.n_columns} cols</div>
            </div>
          </div>

          {session.sources ? (
            <>
              <div className="source-link" />
              <div className="source-node">
                <span className="source-node__dot source-node__dot--b" />
                <div>
                  <div className="source-node__name">{session.sources[1]}</div>
                  <div className="source-node__meta">joined ✓</div>
                </div>
              </div>
            </>
          ) : !secondFile ? (
            <label className="source-add">
              <input type="file" accept=".csv,.xlsx,.xls" onChange={handleSecondUpload} hidden />
              {loadingUpload ? <span className="spinner spinner--dark" /> : '+'}
              {loadingUpload ? 'Reading file…' : 'Add a second file to join'}
            </label>
          ) : (
            <>
              <div className="source-link" />

              {/* File 2 */}
              <div className="source-node">
                <span className="source-node__dot source-node__dot--b" />
                <div>
                  <div className="source-node__name">{secondFile.fileName}</div>
                  <div className="source-node__meta">{secondFile.profile.n_rows.toLocaleString()} rows · {secondFile.profile.n_columns} cols</div>
                </div>
              </div>

              {/* Join config */}
              <div className="join-config">

                {/* Join type */}
                <div className="join-config__row">
                  {JOIN_TYPES.map(jt => (
                    <button key={jt.id}
                      className={`join-type-btn ${joinType === jt.id ? 'join-type-btn--active' : ''}`}
                      onClick={() => setJoinType(jt.id)}>
                      <span>{jt.icon}</span>
                      <span style={{ fontSize: 10 }}>{jt.label}</span>
                    </button>
                  ))}
                </div>

                {/* Key selectors with dtype badges */}
                <div className="join-key-row">
                  <div className="join-key-col">
                    <label className="join-config__label">Key from File 1</label>
                    <select value={key1} onChange={e => { setKey1(e.target.value); setCoerceTo(null) }} className="join-config__select">
                      <option value="">Select column…</option>
                      {keys1.map(k => (
                        <option key={k} value={k}>{k} [{getDtype(session.profile, k)}]</option>
                      ))}
                    </select>
                    {dtype1 && <DTypeBadge dtype={dtype1} />}
                  </div>

                  <span className="join-key-eq">=</span>

                  <div className="join-key-col">
                    <label className="join-config__label">Key from File 2</label>
                    <select value={key2} onChange={e => { setKey2(e.target.value); setCoerceTo(null) }} className="join-config__select">
                      <option value="">Select column…</option>
                      {keys2.map(k => (
                        <option key={k} value={k}>{k} [{getDtype(secondFile?.profile, k)}]</option>
                      ))}
                    </select>
                    {dtype2 && <DTypeBadge dtype={dtype2} />}
                  </div>
                </div>

                {/* Type mismatch warning + coerce selector */}
                {hasMismatch && (
                  <div className="join-mismatch">
                    <div className="join-mismatch__title">
                      ⚠ Type mismatch — <strong>{dtype1}</strong> vs <strong>{dtype2}</strong>
                    </div>
                    <div className="join-mismatch__desc">
                      Choose how to convert both keys before joining:
                    </div>
                    <div className="join-coerce-row">
                      {['string', 'int', 'float'].map(t => (
                        <button key={t}
                          className={`join-coerce-btn ${coerceTo === t ? 'join-coerce-btn--active' : ''}`}
                          onClick={() => setCoerceTo(coerceTo === t ? null : t)}>
                          → {t}
                        </button>
                      ))}
                    </div>
                    {!coerceTo && (
                      <div style={{ fontSize: 11, color: '#92400e', marginTop: 4 }}>
                        No conversion selected — will auto-convert both to text
                      </div>
                    )}
                  </div>
                )}

                {/* AI suggest */}
                <button className="btn btn--ghost btn--sm" onClick={handleAiSuggest}
                  disabled={loadingHint} style={{ width: '100%', justifyContent: 'center' }}>
                  {loadingHint ? <span className="spinner spinner--dark" /> : '✦'}
                  {loadingHint ? 'Thinking…' : 'AI Suggest Key'}
                </button>

                {hint && (
                  <div className="join-hint">
                    <span className={`join-hint__badge join-hint__badge--${hint.confidence}`}>{hint.confidence}</span>
                    {hint.reasoning}
                  </div>
                )}

                {error && <p className="error-msg" style={{ marginTop: 4 }}>⚠ {error}</p>}

                {/* Apply */}
                <button className="btn btn--primary btn--sm"
                  onClick={handleApplyJoin}
                  disabled={!key1 || !key2 || loadingJoin}
                  style={{ width: '100%', justifyContent: 'center', marginTop: 2 }}>
                  {loadingJoin && <span className="spinner" />}
                  {loadingJoin ? 'Joining…' : `Apply ${JOIN_TYPES.find(j => j.id === joinType).label} Join`}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
