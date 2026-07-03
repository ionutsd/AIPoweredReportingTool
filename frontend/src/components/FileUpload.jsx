import { useState } from 'react'
import { uploadFile } from '../api.js'

export default function FileUpload({ onUploaded }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    setError(null)
    try {
      const data = await uploadFile(file)
      onUploaded({ ...data, fileName: file.name })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  return (
    <div className="upload-screen">
      <div className="upload-hero">
        <div className="upload-hero__icon">📊</div>
        <h2 className="upload-hero__title">AI Reporting Assistant</h2>
        <p className="upload-hero__sub">
          Upload any spreadsheet and get instant insights, Q&amp;A, and charts — powered by AI.
        </p>
      </div>

      <label className="upload-dropzone">
        <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} hidden />
        <div className="upload-dropzone__icon">{loading ? '⏳' : '📁'}</div>
        <div>{loading ? 'Reading your file…' : 'Click to upload a CSV or Excel file'}</div>
        <div className="upload-dropzone__hint">Supports .csv · .xlsx · .xls · up to 10 MB</div>
      </label>

      {error && <p className="error-msg">⚠ {error}</p>}

      <div style={{ display: 'flex', gap: 24, color: 'var(--muted)', fontSize: 12 }}>
        <span>🔒 Demo only</span>
        <span>🚫 Don't upload sensitive data</span>
        <span>🆓 Free tier — limited requests</span>
      </div>
    </div>
  )
}
