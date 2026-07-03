import multiprocessing as mp
import pandas as pd
import numpy as np

# Deliberately small allowlist - this runs LLM-generated code, so the
# execution environment should not be able to do anything beyond basic
# data manipulation on the provided dataframe.
ALLOWED_BUILTINS = {
    "len": len, "sum": sum, "min": min, "max": max, "round": round,
    "sorted": sorted, "list": list, "dict": dict, "str": str, "int": int,
    "float": float, "abs": abs, "range": range, "enumerate": enumerate,
}


def _run(code, df, return_dict):
    safe_globals = {"__builtins__": ALLOWED_BUILTINS, "pd": pd, "np": np, "df": df}
    try:
        exec(code, safe_globals)
        result = safe_globals.get("result")
        return_dict["result"] = _serialize(result)
        return_dict["error"] = None
    except Exception as e:
        return_dict["result"] = None
        return_dict["error"] = str(e)


def _serialize(result):
    if isinstance(result, pd.DataFrame):
        df_copy = result.head(50).copy()
        for col in df_copy.columns:
            if pd.api.types.is_period_dtype(df_copy[col]):
                df_copy[col] = df_copy[col].astype(str)
            elif pd.api.types.is_datetime64_any_dtype(df_copy[col]):
                df_copy[col] = df_copy[col].dt.strftime('%Y-%m-%d')
        return df_copy.to_dict(orient="records")
    if isinstance(result, pd.Series):
        s = result.head(50)
        if pd.api.types.is_period_dtype(s.index):
            s.index = s.index.astype(str)
        elif pd.api.types.is_datetime64_any_dtype(s.index):
            s.index = s.index.strftime('%Y-%m-%d')
        return s.to_dict()
    if isinstance(result, (pd.Period, pd.Timestamp)):
        return str(result)
    if isinstance(result, (np.integer,)):
        return int(result)
    if isinstance(result, (np.floating,)):
        return float(result)
    return result


def run_pandas_code(code: str, df: pd.DataFrame, timeout: int = 5) -> dict:
    """Run LLM-generated pandas code in a separate process with a timeout.

    This is a starting point for a demo, not a production sandbox - for a
    public-facing app you'd want a properly isolated sandbox (e.g. a
    container or a service like Pyodide/WASM) rather than a bare process.
    """
    manager = mp.Manager()
    return_dict = manager.dict()
    p = mp.Process(target=_run, args=(code, df, return_dict))
    p.start()
    p.join(timeout)

    if p.is_alive():
        p.terminate()
        p.join()
        return {"result": None, "error": "Execution timed out"}

    return dict(return_dict)
