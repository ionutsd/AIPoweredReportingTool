const API_BASE = import.meta.env.VITE_API_URL || 'https://ai-reporting-tool-backend.onrender.com'

async function handle(res, fallback) {
  if (!res.ok) {
    if (res.status === 429) throw new Error("Demo limit reached — please try again in an hour.")
    const body = await res.json().catch(() => ({}))
    let detail = body.detail || fallback
    // FastAPI 422 errors return detail as an array of validation error objects
    if (Array.isArray(detail)) {
      detail = detail.map(e => e.msg || JSON.stringify(e)).join(', ')
    } else if (typeof detail === 'object') {
      detail = JSON.stringify(detail)
    }
    throw new Error(detail)
  }
  return res.json()
}

export async function uploadFile(file) {
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData })
  return handle(res, 'Upload failed')
}

export async function suggestJoinKey(sessionId1, sessionId2) {
  const res = await fetch(`${API_BASE}/suggest-join-key`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id_1: sessionId1, session_id_2: sessionId2 }),
  })
  return handle(res, 'Could not suggest a join key')
}

export async function joinDatasets(sessionId1, sessionId2, key1, key2, joinType, coerceTo = null) {
  const res = await fetch(`${API_BASE}/join`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id_1: sessionId1, session_id_2: sessionId2, key1, key2, join_type: joinType, coerce_to: coerceTo }),
  })
  return handle(res, 'Could not join the datasets')
}

export async function getInsights(sessionId) {
  const res = await fetch(`${API_BASE}/insights`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId }),
  })
  return handle(res, 'Could not generate insights')
}

export async function askQuestion(sessionId, question) {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, question }),
  })
  return handle(res, 'Could not answer that question')
}

export async function suggestChart(sessionId, description) {
  const res = await fetch(`${API_BASE}/chart-suggest`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, description }),
  })
  return handle(res, 'Could not build that chart')
}

export async function chartFromResult(question, resultData) {
  const res = await fetch(`${API_BASE}/chart-from-result`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, result_data: resultData }),
  })
  return handle(res, 'Could not suggest charts for this result')
}

export async function generateBusinessInsights(fileName, charts) {
  const res = await fetch(`${API_BASE}/business-insights`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_name: fileName, charts }),
  })
  return handle(res, 'Could not generate business insights')
}
