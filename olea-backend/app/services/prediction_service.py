import io
import logging
import lzma
import os
from uuid import UUID

import joblib
import numpy as np
import pandas as pd
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.prediction import Prediction

logger = logging.getLogger(__name__)

_ARTIFACTS_CACHE = None
MODEL_VERSION = "v1.0.0"


def _load_artifacts() -> dict:
    global _ARTIFACTS_CACHE
    if _ARTIFACTS_CACHE is not None:
        return _ARTIFACTS_CACHE

    model_path = settings.PREDICTION_MODEL_PATH

    # Path 1: compressed binary blob
    dat_path = os.path.join(model_path, "model.dat")
    if os.path.exists(dat_path):
        with open(dat_path, "rb") as f:
            raw = lzma.decompress(f.read())
        _ARTIFACTS_CACHE = joblib.load(io.BytesIO(raw))
        logger.info("Loaded model from %s", dat_path)
        return _ARTIFACTS_CACHE

    # Path 2: standard pickle
    pkl_path = os.path.join(model_path, "model.pkl")
    if os.path.exists(pkl_path):
        _ARTIFACTS_CACHE = joblib.load(pkl_path)
        logger.info("Loaded model from %s", pkl_path)
        return _ARTIFACTS_CACHE

    raise FileNotFoundError(f"No model found in {model_path}. Place model.dat or model.pkl there.")


def _preprocess(df: pd.DataFrame, artifacts: dict) -> pd.DataFrame:
    """Apply the same feature engineering pipeline used during training."""
    label_encoders = artifacts["label_encoders"]
    region_freq = artifacts["region_freq"]
    broker_freq = artifacts["broker_freq"]

    df = df.copy()

    if "Employer_ID" in df.columns:
        df.drop(columns=["Employer_ID"], inplace=True)

    df["Child_Dependents"] = df["Child_Dependents"].fillna(0)
    df["Broker_ID"] = df["Broker_ID"].fillna(-1)
    for col in ["Region_Code", "Deductible_Tier", "Acquisition_Channel"]:
        df[col] = df[col].fillna("Missing")

    # Engineered features
    df["Total_Dependents"] = df["Adult_Dependents"] + df["Child_Dependents"] + df["Infant_Dependents"]
    df["Has_Dependents"] = (df["Total_Dependents"] > 0).astype(int)
    df["Income_Per_Dependent"] = df["Estimated_Annual_Income"] / (df["Total_Dependents"] + 1)
    df["Log_Income"] = np.log1p(df["Estimated_Annual_Income"].clip(lower=0))
    df["Claims_Ratio"] = df["Previous_Claims_Filed"] / (df["Years_Without_Claims"] + 1)
    df["Has_Previous_Policy"] = (df["Previous_Policy_Duration_Months"] > 0).astype(int)
    df["Quote_UW_Ratio"] = df["Days_Since_Quote"] / (df["Underwriting_Processing_Days"] + 1)
    df["Vehicles_Plus_Riders"] = df["Vehicles_on_Policy"] + df["Custom_Riders_Requested"]

    month_map = {
        "January": 1, "February": 2, "March": 3, "April": 4, "May": 5, "June": 6,
        "July": 7, "August": 8, "September": 9, "October": 10, "November": 11, "December": 12,
    }
    df["Month_Num"] = df["Policy_Start_Month"].map(month_map)
    df["Month_Sin"] = np.sin(2 * np.pi * df["Month_Num"] / 12)
    df["Month_Cos"] = np.cos(2 * np.pi * df["Month_Num"] / 12)

    # Label-encode categoricals
    cat_features = [
        "Region_Code", "Broker_Agency_Type", "Deductible_Tier",
        "Acquisition_Channel", "Payment_Schedule", "Employment_Status", "Policy_Start_Month",
    ]
    for col in cat_features:
        le = label_encoders[col]
        known = set(le.classes_)
        df[col] = df[col].astype(str).apply(lambda x, k=known, d=le.classes_[0]: x if x in k else d)
        df[col] = le.transform(df[col])

    # Frequency encodings
    df["Region_Freq"] = df["Region_Code"].map(region_freq).fillna(0)
    df["Broker_Freq"] = df["Broker_ID"].map(broker_freq).fillna(0)

    return df


def _run_inference(df: pd.DataFrame, artifacts: dict) -> tuple[np.ndarray, np.ndarray | None]:
    """Run model inference, return (predictions, probabilities_or_None)."""
    feature_cols = artifacts["feature_cols"]
    thresholds = artifacts.get("thresholds")
    model = artifacts["model"]

    X = np.ascontiguousarray(df[feature_cols].values, dtype=np.float32)

    proba = None
    if thresholds is not None:
        proba = model.predict_proba(X)
        preds = (proba - thresholds[np.newaxis, :]).argmax(axis=1)
    else:
        preds = model.predict(X)
        if hasattr(model, "predict_proba"):
            proba = model.predict_proba(X)

    return preds, proba


async def run_prediction(db: AsyncSession, form_id: UUID, form_data: dict) -> Prediction:
    """Run the coverage-bundle prediction model on form data."""
    artifacts = _load_artifacts()

    df = pd.DataFrame([form_data])
    df_processed = _preprocess(df, artifacts)
    preds, proba = _run_inference(df_processed, artifacts)

    predicted_bundle = int(preds[0])
    confidence = float(proba[0].max()) if proba is not None else 0.0

    result = {
        "purchased_coverage_bundle": predicted_bundle,
        "confidence": confidence,
    }
    if proba is not None:
        result["probabilities"] = {str(i): round(float(p), 4) for i, p in enumerate(proba[0])}

    prediction = Prediction(
        form_id=form_id,
        model_version=MODEL_VERSION,
        result=result,
        confidence=confidence,
    )
    db.add(prediction)
    await db.commit()
    await db.refresh(prediction)
    return prediction


async def get_prediction(db: AsyncSession, prediction_id: UUID) -> Prediction | None:
    return await db.get(Prediction, prediction_id)
