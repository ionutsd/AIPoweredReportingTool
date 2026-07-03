import pandas as pd
import numpy as np


def profile_dataframe(df: pd.DataFrame) -> dict:
    """Build a lightweight schema/profile summary for a dataframe.

    This is what gets sent to Claude instead of the raw data -
    keeps token usage low and avoids sending user data to the LLM
    beyond column-level statistics.
    """
    profile = {
        "n_rows": len(df),
        "n_columns": len(df.columns),
        "columns": [],
    }

    for col in df.columns:
        series = df[col]
        col_info = {
            "name": str(col),
            "dtype": str(series.dtype),
            "null_count": int(series.isnull().sum()),
            "null_pct": round(float(series.isnull().mean()) * 100, 2),
        }

        if pd.api.types.is_numeric_dtype(series):
            col_info["type"] = "numeric"
            desc = series.describe()
            col_info["stats"] = {
                "min": _safe_float(desc.get("min")),
                "max": _safe_float(desc.get("max")),
                "mean": _safe_float(desc.get("mean")),
                "std": _safe_float(desc.get("std")),
            }
        elif pd.api.types.is_datetime64_any_dtype(series):
            col_info["type"] = "datetime"
            col_info["stats"] = {"min": str(series.min()), "max": str(series.max())}
        else:
            parsed = pd.to_datetime(series, errors="coerce")
            if series.notna().any() and parsed.notna().mean() > 0.8:
                col_info["type"] = "datetime"
                col_info["stats"] = {"min": str(parsed.min()), "max": str(parsed.max())}
            else:
                col_info["type"] = "categorical"
                top_values = series.value_counts(dropna=True).head(5)
                col_info["stats"] = {
                    "unique_count": int(series.nunique(dropna=True)),
                    "top_values": {str(k): int(v) for k, v in top_values.items()},
                }

        profile["columns"].append(col_info)

    return profile


def _safe_float(value):
    try:
        if value is None or (isinstance(value, float) and np.isnan(value)):
            return None
        return float(value)
    except (TypeError, ValueError):
        return None
