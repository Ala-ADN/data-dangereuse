import logging
from uuid import UUID

import numpy as np
import pandas as pd

from app.services.prediction_service import _load_artifacts, _preprocess

logger = logging.getLogger(__name__)


async def explain_prediction(prediction_id: UUID, prediction_result: dict, form_data: dict | None = None) -> dict:
    """Generate feature-importance explanation for a prediction.

    If form_data is provided, uses the actual model's feature importances.
    Falls back to model-level global importances otherwise.

    TODO: Integrate SHAP or LIME for per-instance local explanations.
    """
    try:
        artifacts = _load_artifacts()
        model = artifacts["model"]
        feature_cols = artifacts["feature_cols"]

        # Try to get global feature importances from the model
        if hasattr(model, "feature_importances_"):
            importances = model.feature_importances_
        elif hasattr(model, "coef_"):
            importances = np.abs(model.coef_).mean(axis=0) if model.coef_.ndim > 1 else np.abs(model.coef_)
        else:
            importances = np.ones(len(feature_cols)) / len(feature_cols)

        # Sort by importance descending
        indices = np.argsort(importances)[::-1]
        top_n = min(10, len(indices))

        feature_importances = []
        for i in indices[:top_n]:
            feature_importances.append({
                "feature": feature_cols[i],
                "importance": round(float(importances[i]), 4),
                "direction": "positive",  # global importances don't indicate direction
            })

        summary_features = ", ".join(f["feature"] for f in feature_importances[:5])
        summary = f"Top contributing features: {summary_features}."

    except Exception:
        logger.exception("Failed to compute explainability, returning stub")
        feature_importances = [
            {"feature": "Estimated_Annual_Income", "importance": 0.30, "direction": "positive"},
            {"feature": "Previous_Claims_Filed", "importance": 0.20, "direction": "negative"},
            {"feature": "Vehicles_on_Policy", "importance": 0.15, "direction": "positive"},
        ]
        summary = "Stub explanation: model artifacts not available."

    return {
        "prediction_id": str(prediction_id),
        "method": "global_importance",
        "feature_importances": feature_importances,
        "summary": summary,
    }
