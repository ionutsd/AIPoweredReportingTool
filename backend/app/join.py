import pandas as pd

JOIN_MAP = {"left": "left", "right": "right", "inner": "inner"}
COERCE_MAP = {"string": str, "int": "Int64", "float": float}


def get_column_dtype(df: pd.DataFrame, col: str) -> str:
    """Return a short human-readable dtype label for a column."""
    if col not in df.columns:
        return "unknown"
    dtype = df[col].dtype
    if pd.api.types.is_integer_dtype(dtype):
        return "int"
    if pd.api.types.is_float_dtype(dtype):
        return "float"
    if pd.api.types.is_datetime64_any_dtype(dtype):
        return "datetime"
    return "text"


def join_dataframes(
    df1: pd.DataFrame,
    df2: pd.DataFrame,
    key1: str,
    key2: str,
    join_type: str,
    coerce_to: str = None,          # "string" | "int" | "float" | None
) -> pd.DataFrame:
    """Join two dataframes.

    If coerce_to is set, both key columns are cast to that type before merging.
    Otherwise, if the dtypes differ we cast both to string automatically and
    strip whitespace to avoid the pandas int64/object error.
    """
    if key1 not in df1.columns:
        raise ValueError(f"Key '{key1}' not found in File 1")
    if key2 not in df2.columns:
        raise ValueError(f"Key '{key2}' not found in File 2")
    if join_type not in JOIN_MAP:
        raise ValueError(f"Unsupported join type '{join_type}'")

    df1 = df1.copy()
    df2 = df2.copy()

    if coerce_to:
        if coerce_to not in COERCE_MAP:
            raise ValueError(f"Unsupported coerce type '{coerce_to}'. Use string, int, or float.")
        target = COERCE_MAP[coerce_to]
        try:
            if coerce_to == "string":
                df1[key1] = df1[key1].astype(str).str.strip()
                df2[key2] = df2[key2].astype(str).str.strip()
            else:
                df1[key1] = pd.to_numeric(df1[key1], errors="raise").astype(target)
                df2[key2] = pd.to_numeric(df2[key2], errors="raise").astype(target)
        except Exception as e:
            raise ValueError(f"Could not convert keys to {coerce_to}: {e}")
    elif df1[key1].dtype != df2[key2].dtype:
        # Auto-fallback: cast both to string
        df1[key1] = df1[key1].astype(str).str.strip()
        df2[key2] = df2[key2].astype(str).str.strip()

    return pd.merge(df1, df2, left_on=key1, right_on=key2,
                    how=JOIN_MAP[join_type], suffixes=("", "_2"))


def common_columns(df1: pd.DataFrame, df2: pd.DataFrame) -> list[str]:
    return sorted(set(df1.columns) & set(df2.columns))
