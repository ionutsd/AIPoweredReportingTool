import uuid
from io import BytesIO

import pandas as pd
from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from typing import Optional

from app.profiling import profile_dataframe
from app import ai_service
from app.sandbox import run_pandas_code
from app.join import join_dataframes, common_columns, get_column_dtype

load_dotenv()

limiter = Limiter(key_func=get_remote_address)

app = FastAPI(title="AI Reporting Tool API")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# session_id -> dataframe. A "raw" upload gets one session; a second file
# uploaded alongside it gets its own session_id too, until joined.
SESSIONS: dict[str, pd.DataFrame] = {}
MAX_FILE_SIZE_MB = 10

LIMIT_UPLOAD     = "10/hour"
LIMIT_INSIGHTS   = "5/hour"
LIMIT_CHAT       = "20/hour"
LIMIT_CHART      = "15/hour"
LIMIT_CHART_CHAT = "20/hour"
LIMIT_JOIN_HINT  = "10/hour"
LIMIT_JOIN       = "10/hour"
LIMIT_BIZ        = "8/hour"


class SessionRequest(BaseModel):
    session_id: str

class ChatRequest(BaseModel):
    session_id: str
    question: str

class ChartRequest(BaseModel):
    session_id: str
    description: str

class ChartFromResultRequest(BaseModel):
    question: str
    result_data: list

class BusinessInsightsRequest(BaseModel):
    file_name: str
    charts: list  # [{ title, spec, data }]

class JoinHintRequest(BaseModel):
    session_id_1: str
    session_id_2: str

class JoinRequest(BaseModel):
    session_id_1: str
    session_id_2: str
    key1: str
    key2: str
    join_type: str              # left | right | inner
    coerce_to: Optional[str] = None  # string | int | float | None


@app.get("/health")
def health():
    return {"status": "ok"}


def _read_upload(contents: bytes, filename: str) -> pd.DataFrame:
    filename = filename.lower()
    if filename.endswith(".csv"):
        return pd.read_csv(BytesIO(contents))
    if filename.endswith((".xlsx", ".xls")):
        return pd.read_excel(BytesIO(contents))
    raise HTTPException(status_code=400, detail="Only .csv, .xlsx, .xls files are supported")


@app.post("/upload")
@limiter.limit(LIMIT_UPLOAD)
async def upload_file(request: Request, file: UploadFile = File(...)):
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File exceeds {MAX_FILE_SIZE_MB}MB limit")
    try:
        df = _read_upload(contents, file.filename or "")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Could not read file: {e}")

    session_id = str(uuid.uuid4())
    SESSIONS[session_id] = df
    return {"session_id": session_id, "profile": profile_dataframe(df)}


@app.post("/suggest-join-key")
@limiter.limit(LIMIT_JOIN_HINT)
def suggest_join_key(request: Request, req: JoinHintRequest):
    df1 = _get_df(req.session_id_1)
    df2 = _get_df(req.session_id_2)
    p1, p2 = profile_dataframe(df1), profile_dataframe(df2)
    suggestion = ai_service.suggest_join_key(p1, p2)
    suggestion["common_columns"] = common_columns(df1, df2)
    # Return dtype of every column so the frontend can warn about mismatches
    suggestion["dtypes_1"] = {c["name"]: get_column_dtype(df1, c["name"]) for c in p1["columns"]}
    suggestion["dtypes_2"] = {c["name"]: get_column_dtype(df2, c["name"]) for c in p2["columns"]}
    return suggestion


@app.post("/join")
@limiter.limit(LIMIT_JOIN)
def join(request: Request, req: JoinRequest):
    df1 = _get_df(req.session_id_1)
    df2 = _get_df(req.session_id_2)
    try:
        merged = join_dataframes(df1, df2, req.key1, req.key2, req.join_type, req.coerce_to)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    session_id = str(uuid.uuid4())
    SESSIONS[session_id] = merged
    return {"session_id": session_id, "profile": profile_dataframe(merged)}


@app.post("/insights")
@limiter.limit(LIMIT_INSIGHTS)
def insights(request: Request, req: SessionRequest):
    df = _get_df(req.session_id)
    return ai_service.generate_insights(profile_dataframe(df))


@app.post("/chat")
@limiter.limit(LIMIT_CHAT)
def chat(request: Request, req: ChatRequest):
    df = _get_df(req.session_id)
    profile = profile_dataframe(df)
    code = ai_service.generate_pandas_code(profile, req.question)
    output = run_pandas_code(code, df)
    return {"code": code, **output}


@app.post("/chart-suggest")
@limiter.limit(LIMIT_CHART)
def chart_suggest(request: Request, req: ChartRequest):
    df = _get_df(req.session_id)
    profile = profile_dataframe(df)
    spec = ai_service.generate_chart_spec(profile, req.description)
    data = _prepare_chart_data(df, spec)
    return {"spec": spec, "data": data}


@app.post("/chart-from-result")
@limiter.limit(LIMIT_CHART_CHAT)
def chart_from_result(request: Request, req: ChartFromResultRequest):
    if not req.result_data or not isinstance(req.result_data, list):
        raise HTTPException(status_code=400, detail="result_data must be a non-empty list")
    suggestions = ai_service.suggest_charts_from_result(req.question, req.result_data)
    return {"suggestions": suggestions, "data": req.result_data}


@app.post("/business-insights")
@limiter.limit(LIMIT_BIZ)
def business_insights(request: Request, req: BusinessInsightsRequest):
    if not req.charts:
        raise HTTPException(status_code=400, detail="Add at least one chart to the dashboard first")
    return ai_service.generate_business_insights(req.file_name, req.charts)


def _prepare_chart_data(df: pd.DataFrame, spec: dict):
    """Shape dataframe data according to chart type.

    Key rule: pie/donut/bar/line charts always need aggregated data —
    groupby x and sum y whenever raw rows > unique x values.
    """
    chart_type = spec.get("chart_type")
    x, y, stack_by = spec.get("x"), spec.get("y"), spec.get("stack_by")

    # ── KPI: single metric ──────────────────────────────────────────────
    if chart_type == "kpi":
        agg = spec.get("aggregation") or "sum"
        if y and y in df.columns:
            value = getattr(df[y], agg)()
            return [{"label": spec.get("title", y), "value": float(value)}]
        return [{"label": spec.get("title", "Count"), "value": int(len(df))}]

    # ── Stacked bar: pivot needed ────────────────────────────────────────
    if chart_type in ("bar_stacked_v", "bar_stacked_h") and stack_by and x and y:
        if x in df.columns and y in df.columns and stack_by in df.columns:
            pivoted = df.pivot_table(
                index=x, columns=stack_by, values=y,
                aggfunc="sum", fill_value=0
            ).reset_index()
            return pivoted.to_dict(orient="records")

    # ── Pie / donut / bar / line: aggregate if needed ────────────────────
    if chart_type in ("pie", "donut", "bar", "line", "scatter") and x and y:
        if x in df.columns and y in df.columns:
            n_rows = len(df)
            n_unique = df[x].nunique()

            # Aggregate whenever there are more rows than unique x values
            # (i.e. the data hasn't been pre-aggregated)
            if n_rows > n_unique:
                try:
                    agg_df = (
                        df.groupby(x, dropna=False)[y]
                        .sum()
                        .reset_index()
                        .sort_values(y, ascending=False)
                    )
                    # Pie/donut: cap at 12 slices so the chart stays readable
                    if chart_type in ("pie", "donut"):
                        agg_df = agg_df.head(12)
                    else:
                        agg_df = agg_df.head(50)
                    return agg_df.to_dict(orient="records")
                except Exception:
                    pass  # fall through to raw slice below

            return df[[x, y]].head(50).to_dict(orient="records")

    # ── Fallback: return the relevant columns raw ────────────────────────
    cols = [c for c in [x, y] if c and c in df.columns]
    return df[cols].head(50).to_dict(orient="records") if cols else []


def _get_df(session_id: str) -> pd.DataFrame:
    df = SESSIONS.get(session_id)
    if df is None:
        raise HTTPException(status_code=404, detail="Session not found. Please re-upload your file.")
    return df
