import os
import json
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

_client = None
MODEL = "llama-3.3-70b-versatile"


def _get_client():
    """Return the Groq client, creating it on first call.

    This avoids the client being instantiated at import time before
    environment variables are available (e.g. on Render).
    """
    global _client
    if _client is None:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY environment variable is not set")
        _client = Groq(api_key=api_key)
    return _client


def _clean_json(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        lines = lines[1:] if lines[0].startswith("```") else lines
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines)
    return text.strip()


def generate_insights(profile: dict) -> dict:
    prompt = f"""You are a senior data analyst reviewing a new dataset for the first time.
Schema profile (column types and summary statistics — NOT raw rows):
{json.dumps(profile, indent=2)}

Respond with ONLY a JSON object, no markdown, in exactly this shape:
{{
  "insights": ["bullet 1", "bullet 2", "bullet 3", "bullet 4"],
  "next_steps": [
    {{
      "title": "short action title",
      "description": "1-2 sentences: what to do and why it is analytically valuable for THIS dataset",
      "analysis_type": "one of: trend analysis | segmentation | correlation | distribution | outlier detection | time series | ranking | comparison"
    }}
  ]
}}
Rules:
- insights: 4-6 bullets, plain language, interpret numbers rather than restate them
- next_steps: 4-5 items, genuinely specific to THIS dataset
- No generic filler, no jargon
- Return ONLY valid JSON"""
    r = _get_client().chat.completions.create(model=MODEL, max_tokens=900,
        messages=[{"role": "user", "content": prompt}])
    return json.loads(_clean_json(r.choices[0].message.content))


def generate_pandas_code(profile: dict, question: str) -> str:
    col_names = [c["name"] for c in profile["columns"]]
    numeric_cols = [c["name"] for c in profile["columns"] if c["type"] == "numeric"]
    cat_cols = [c["name"] for c in profile["columns"] if c["type"] == "categorical"]
    date_cols = [c["name"] for c in profile["columns"] if c["type"] == "datetime"]

    # Build a compact dtype map so the LLM can see exact types
    dtype_map = {c["name"]: c["dtype"] for c in profile["columns"]}

    prompt = f"""You are a senior data analyst. You have a pandas DataFrame `df`.

COLUMN NAMES AND EXACT DTYPES:
{json.dumps(dtype_map, indent=2)}

Numeric columns  : {numeric_cols}
Categorical cols : {cat_cols}
Datetime cols    : {date_cols}

QUESTION: "{question}"

════════════════════════════════════════
MANDATORY RULES — read every one before writing a single line:
════════════════════════════════════════

RULE 1 — Always store the final answer in `result`.

RULE 2 — DATETIME COLUMNS (columns whose dtype starts with "datetime"):
  • NEVER call .dt directly on a raw column — first convert:
      date_series = pd.to_datetime(df['col'], errors='coerce')
  • Then use date_series.dt.to_period('M').astype(str) for monthly grouping.
  • Then use date_series.dt.year for yearly grouping.
  • Pattern: result = df.groupby(pd.to_datetime(df['DateCol'], errors='coerce').dt.to_period('M').astype(str))['Metric'].sum().reset_index()

RULE 3 — CATEGORICAL / STRING COLUMNS that look like time (Month, Year, Quarter, Day, Week):
  • If a column is categorical dtype and its name suggests a time period, group it DIRECTLY — DO NOT call .dt on it.
  • Pattern: result = df.groupby('Month')['Quantity_Sold'].sum().reset_index()

RULE 4 — AGGREGATION IS MANDATORY when the question implies summarising:
  • "trend / by month / by year / over time" → groupby the time column + aggregate metric
  • "top N X by Y" → groupby X, aggregate Y, then .nlargest(N, 'Y').reset_index()
  • "by [column]" anywhere in question → groupby that column, never return raw rows
  • "total / sum" → .sum()   |   "average / mean" → .mean()   |   "count" → .size()

RULE 5 — NEVER return raw unaggregated rows for summary questions.
  Every groupby must be followed by an aggregation (.sum, .mean, .size, .count, .nlargest).

RULE 6 — Always call .reset_index() after groupby.

RULE 7 — Use EXACT column names from the dtype map. Never invent column names.

RULE 8 — Limit to 50 rows max: .head(50) or .nlargest(N).

════════════════════════════════════════
WORKED EXAMPLES — match the pattern exactly for similar questions:
════════════════════════════════════════

Q: "monthly trend for quantity sold" — Date col is datetime dtype
result = df.groupby(pd.to_datetime(df['Date'], errors='coerce').dt.to_period('M').astype(str))['Quantity_Sold'].sum().reset_index()
result.columns = ['Month', 'Quantity_Sold']

Q: "quantity sold by month" — Month col is categorical/string dtype
result = df.groupby('Month')['Quantity_Sold'].sum().reset_index()

Q: "top 10 products by revenue"
result = df.groupby('Product')['Revenue'].sum().nlargest(10).reset_index()

Q: "average price by category"
result = df.groupby('Category')['Price'].mean().reset_index()

Q: "sales by region and product"
result = df.groupby(['Region', 'Product'])['Sales'].sum().reset_index()

Q: "count of orders by status"
result = df.groupby('Status').size().reset_index(name='Count')

Q: "total revenue"
result = df['Revenue'].sum()

Q: "quantity sold by age group" — AgeGroup is categorical
result = df.groupby('AgeGroup')['Quantity_Sold'].sum().reset_index()

════════════════════════════════════════
Return ONLY the Python code. No explanation, no markdown fences, no imports.
════════════════════════════════════════"""

    r = _get_client().chat.completions.create(model=MODEL, max_tokens=600,
        messages=[{"role": "user", "content": prompt}])
    return _clean_json(r.choices[0].message.content)


def generate_chart_spec(profile: dict, description: str) -> dict:
    prompt = f"""Given this dataset schema profile:
{json.dumps(profile, indent=2)}

User wants: "{description}"

Available chart types and when to use them:
- "bar"            compare categories (single metric per category)
- "bar_stacked_v"  compare categories with sub-groups stacked vertically; requires stack_by column
- "bar_stacked_h"  same but horizontal bars (good for long category names)
- "line"           trend over time or an ordered sequence
- "scatter"        correlation between two numeric columns
- "pie"            part-to-whole for a small number of categories (<= 8)
- "donut"          same as pie but with a hole in the middle; better for dashboards
- "kpi"            a single important metric (total, average, count); no axes needed

Respond ONLY with a JSON object (no markdown):
{{
  "chart_type": "<one of the types above>",
  "x": "<column name or null>",
  "y": "<numeric column name or null>",
  "stack_by": "<column to stack/group by - only for bar_stacked_v / bar_stacked_h, else null>",
  "aggregation": "<sum|mean|count - only for kpi type, else null>",
  "title": "<short descriptive chart title>",
  "reasoning": "<one sentence: why this chart type fits>"
}}
Use only column names that exist in the schema above."""

    r = _get_client().chat.completions.create(model=MODEL, max_tokens=350,
        messages=[{"role": "user", "content": prompt}])
    return json.loads(_clean_json(r.choices[0].message.content))


def suggest_charts_from_result(question: str, result_data: list) -> list:
    sample = result_data[:10]
    prompt = f"""A user asked: "{question}"
Query returned (sample): {json.dumps(sample, indent=2)}

Suggest 2-3 chart types to visualise this result.
Available types: bar, bar_stacked_v, bar_stacked_h, line, scatter, pie, donut, kpi

Respond ONLY with a JSON array:
[
  {{
    "chart_type": "<type>",
    "x": "<key from result to use as X/label>",
    "y": "<key from result to use as Y/value>",
    "title": "<short chart title>",
    "reasoning": "<one sentence why this fits>"
  }}
]
Use only key names that actually appear in the result sample."""

    r = _get_client().chat.completions.create(model=MODEL, max_tokens=500,
        messages=[{"role": "user", "content": prompt}])
    return json.loads(_clean_json(r.choices[0].message.content))


def suggest_join_key(profile1: dict, profile2: dict) -> dict:
    cols1 = [c["name"] for c in profile1["columns"]]
    cols2 = [c["name"] for c in profile2["columns"]]

    prompt = f"""You are a data engineer. You need to join two datasets that may
use DIFFERENT column names for the same real-world concept (e.g. "CustomerID" vs "Cust_ID").

Dataset 1 columns: {cols1}
Dataset 2 columns: {cols2}

Profile 1:
{json.dumps(profile1, indent=2)}

Profile 2:
{json.dumps(profile2, indent=2)}

Suggest the best column from EACH dataset to use as the join key - they do not
need to share the same name, but should represent the same entity (same kind
of ID, same category, etc).

Respond ONLY with a JSON object:
{{
  "suggested_key_1": "<column name from Dataset 1>",
  "suggested_key_2": "<column name from Dataset 2>",
  "confidence": "high|medium|low",
  "reasoning": "<one sentence explaining why these two columns match>"
}}"""

    r = _get_client().chat.completions.create(model=MODEL, max_tokens=220,
        messages=[{"role": "user", "content": prompt}])
    return json.loads(_clean_json(r.choices[0].message.content))


def generate_business_insights(file_name: str, charts: list) -> dict:
    """Given the set of charts a user collected on their dashboard, produce
    a strategic business read: what the combination of visuals suggests,
    and concrete recommendations to improve outcomes.

    `charts` is a list of {title, spec, data} - only a sample of each
    chart's data is sent to keep token usage low.
    """
    chart_summaries = []
    for c in charts:
        sample_data = c.get("data", [])[:8]
        chart_summaries.append({
            "title": c.get("title"),
            "chart_type": c.get("spec", {}).get("chart_type"),
            "sample_data": sample_data,
        })

    prompt = f"""You are a senior business analyst reviewing a dashboard built
from the file "{file_name}". The dashboard contains these charts:

{json.dumps(chart_summaries, indent=2)}

Write a strategic business read of this dashboard as a whole - not a
restatement of each chart, but what the COMBINATION suggests about
performance, risk, and opportunity.

Respond with ONLY a JSON object, no markdown, in exactly this shape:
{{
  "summary": "2-3 sentence executive summary of what this dashboard tells a decision-maker",
  "trends": [
    "specific trend or pattern observed across the charts, written for a business audience"
  ],
  "risks": [
    "a specific risk or concern visible in this data, if any — omit generic risk language"
  ],
  "recommendations": [
    {{
      "action": "short, specific recommended action",
      "rationale": "1-2 sentences tying it back to what the data shows",
      "impact": "high|medium|low"
    }}
  ]
}}

Rules:
- trends: 2-4 items, must reference the actual data shown, not generic statements
- risks: 1-3 items; if nothing concerning stands out, return an empty array
- recommendations: 3-5 items, concrete and actionable, not "monitor closely" or "do more research"
- Write for a business stakeholder, not a data scientist — avoid technical jargon
- Return ONLY valid JSON"""

    r = _get_client().chat.completions.create(model=MODEL, max_tokens=1100,
        messages=[{"role": "user", "content": prompt}])
    return json.loads(_clean_json(r.choices[0].message.content))
