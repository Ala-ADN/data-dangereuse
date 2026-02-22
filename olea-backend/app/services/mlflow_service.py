"""
MLflow integration — experiment tracking and model registry.

Responsibilities:
  1. Track every prediction as an MLflow run (features in, bundle out)
  2. Try to load the production model from MLflow Model Registry on startup
  3. Fallback to local model.pkl if MLflow is unreachable
  4. Provide health status for the /health endpoint
"""

from __future__ import annotations

import logging
import time
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

_client = None
_experiment_id: str | None = None

EXPERIMENT_NAME = "certus-predictions"
REGISTERED_MODEL_NAME = "certus-xgboost"


def init_mlflow() -> None:
    """Initialize MLflow tracking client and experiment."""
    global _client, _experiment_id

    if not settings.MLFLOW_TRACKING_URI:
        logger.info("MLflow tracking URI not set — tracking disabled")
        return

    try:
        import mlflow

        mlflow.set_tracking_uri(settings.MLFLOW_TRACKING_URI)

        experiment = mlflow.get_experiment_by_name(EXPERIMENT_NAME)
        if experiment is None:
            _experiment_id = mlflow.create_experiment(EXPERIMENT_NAME)
            logger.info("Created MLflow experiment '%s' (id=%s)", EXPERIMENT_NAME, _experiment_id)
        else:
            _experiment_id = experiment.experiment_id

        _client = mlflow.MlflowClient()
        logger.info("✅ MLflow connected — %s (experiment=%s)", settings.MLFLOW_TRACKING_URI, _experiment_id)
    except Exception as e:
        logger.warning("⚠️  MLflow unavailable, tracking disabled: %s", e)
        _client = None


def log_prediction(
    features: dict[str, Any],
    predicted_bundle: int,
    confidence: float,
    latency_ms: float,
    cached: bool = False,
    model_version: str = "unknown",
) -> None:
    """Log a prediction as an MLflow run (non-blocking, fire-and-forget)."""
    if _client is None or _experiment_id is None:
        return

    try:
        import mlflow

        with mlflow.start_run(experiment_id=_experiment_id, run_name=f"pred-bundle-{predicted_bundle}"):
            # Log feature values as params (truncate to MLflow 500-char limit)
            for k, v in features.items():
                try:
                    mlflow.log_param(k, str(v)[:500])
                except Exception:
                    pass

            # Log prediction metrics
            mlflow.log_metric("predicted_bundle", predicted_bundle)
            mlflow.log_metric("confidence", confidence)
            mlflow.log_metric("latency_ms", latency_ms)
            mlflow.log_metric("cached", int(cached))

            mlflow.set_tag("model_version", model_version)
            mlflow.set_tag("source", "api")

    except Exception as e:
        logger.debug("MLflow logging failed (non-critical): %s", e)


def try_load_registry_model():
    """
    Try to load the production model from MLflow Model Registry.

    Returns (model, artifacts_dict) or None if unavailable.
    Falls back gracefully to local model loading.
    """
    if _client is None:
        return None

    try:
        import mlflow

        model_uri = f"models:/{REGISTERED_MODEL_NAME}/Production"
        model = mlflow.xgboost.load_model(model_uri)
        logger.info("✅ Loaded model from MLflow registry: %s/Production", REGISTERED_MODEL_NAME)
        return model
    except Exception as e:
        logger.info("MLflow registry model not found, using local: %s", e)
        return None


def register_model(model_path: str, metrics: dict[str, float] | None = None) -> None:
    """Register a trained model to MLflow (for the training pipeline to call)."""
    if _client is None:
        logger.warning("Cannot register model — MLflow not connected")
        return

    try:
        import mlflow
        import mlflow.xgboost

        with mlflow.start_run(experiment_id=_experiment_id, run_name="model-registration"):
            if metrics:
                for k, v in metrics.items():
                    mlflow.log_metric(k, v)

            mlflow.xgboost.log_model(
                xgb_model=model_path,
                artifact_path="model",
                registered_model_name=REGISTERED_MODEL_NAME,
            )
            logger.info("✅ Model registered to MLflow as '%s'", REGISTERED_MODEL_NAME)
    except Exception as e:
        logger.error("Model registration failed: %s", e)


def get_mlflow_status() -> dict:
    """Return MLflow health info for the /health endpoint."""
    if _client is None:
        return {"status": "disabled", "reason": "MLflow not configured or unreachable"}

    try:
        experiments = _client.search_experiments()
        return {
            "status": "connected",
            "tracking_uri": settings.MLFLOW_TRACKING_URI,
            "experiment": EXPERIMENT_NAME,
            "experiment_id": _experiment_id,
            "total_experiments": len(experiments),
        }
    except Exception as e:
        return {"status": "error", "reason": str(e)}
