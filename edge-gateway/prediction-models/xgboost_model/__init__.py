"""XGBoost flood prediction model package."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from xgboost_model.xgboost_model import (  # noqa: E402
    LocationAwareFloodXGBoostModel,
    MODEL_SAVE_PATH,
)

__all__ = ["LocationAwareFloodXGBoostModel", "MODEL_SAVE_PATH"]