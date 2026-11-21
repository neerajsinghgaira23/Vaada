"""
backend/app/voice_agent/settings.py — Settings for Sarvam AI Voice Agent.
"""
from __future__ import annotations

import os
from pathlib import Path


def _env(key: str, default: str) -> str:
    val = os.getenv(key)
    return default if val is None or val == "" else val


def _flag(key: str, default: bool) -> bool:
    val = os.getenv(key)
    if val is None or val == "":
        return default
    return val.strip().lower() in {"1", "true", "yes", "on"}


class VoiceSettings:
    def __init__(self) -> None:
        # Sarvam AI (Speech-to-Text, Text-to-Speech, Chat model)
        self.sarvam_api_key = _env("SARVAM_API_KEY", "")
        self.sarvam_base = _env("SARVAM_BASE_URL", "https://api.sarvam.ai").rstrip("/")
        self.stt_model = _env("SARVAM_STT_MODEL", "saaras:v4")
        self.tts_model = _env("SARVAM_TTS_MODEL", "bulbul:v3")
        self.tts_speaker = _env("SARVAM_TTS_SPEAKER", "shubh")
        self.llm_model = _env("SARVAM_LLM_MODEL", "sarvam-105b-conversations")
        self.llm_path = _env("SARVAM_LLM_PATH", "/v2/chat/completions")

        # Cashfree
        self.cf_client_id = _env("CASHFREE_CLIENT_ID", "")
        self.cf_client_secret = _env("CASHFREE_CLIENT_SECRET", "")
        self.cf_env = _env("CASHFREE_ENV", "sandbox").strip().lower()
        self.cf_pg_version = _env("CASHFREE_API_VERSION", "2023-08-01")
        self.return_url = _env("CASHFREE_RETURN_URL", "https://example.com/payment-done")

        # Guardrails
        self.max_amount = float(_env("MAX_AMOUNT_INR", "50000"))
        self.allow_payouts = _flag("ALLOW_PAYOUTS", True)
        self.mock = _flag(
            "MOCK_MODE",
            not (self.cf_client_id and self.cf_client_secret and not self.cf_client_id.startswith("CF_SANDBOX")),
        )
        self.merchants: list[dict] = []
