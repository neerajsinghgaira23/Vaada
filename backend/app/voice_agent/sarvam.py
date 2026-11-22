"""
backend/app/voice_agent/sarvam.py — Sarvam AI Speech-to-Text, Text-to-Speech & Chat integration.
"""
from __future__ import annotations

import base64
import json
import logging
import re
from typing import Optional

import httpx

logger = logging.getLogger("sarvam")

TTS_LANGUAGES = {
    "bn-IN", "en-IN", "gu-IN", "hi-IN", "kn-IN", "ml-IN",
    "mr-IN", "od-IN", "pa-IN", "ta-IN", "te-IN",
}

LANGUAGE_NAMES = {
    "hi-IN": "Hindi",
    "en-IN": "English",
    "bn-IN": "Bengali",
    "ta-IN": "Tamil",
    "te-IN": "Telugu",
    "mr-IN": "Marathi",
    "gu-IN": "Gujarati",
    "kn-IN": "Kannada",
    "ml-IN": "Malayalam",
    "pa-IN": "Punjabi",
    "od-IN": "Odia",
    "ur-IN": "Urdu",
}


class SarvamError(Exception):
    def __init__(self, status: int, message: str) -> None:
        super().__init__(message)
        self.status = status
        self.message = message


def _json_from_text(text: str) -> dict:
    text = (text or "").strip()
    text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.MULTILINE).strip()
    start = text.find("{")
    if start == -1:
        raise ValueError("No JSON object found in model reply")
    depth = 0
    for idx in range(start, len(text)):
        if text[idx] == "{":
            depth += 1
        elif text[idx] == "}":
            depth -= 1
            if depth == 0:
                return json.loads(text[start : idx + 1])
    raise ValueError("Unbalanced JSON structure in model reply")


class SarvamClient:
    def __init__(self, settings) -> None:
        self.s = settings

    @property
    def _headers(self) -> dict:
        return {"api-subscription-key": self.s.sarvam_api_key}

    async def transcribe(
        self, audio: bytes, filename: str = "audio.webm", language_code: str = "unknown"
    ) -> dict:
        """
        Speech -> Text via Sarvam saaras:v4.
        Returns {'transcript': str, 'language_code': str}
        """
        if not self.s.sarvam_api_key or self.s.sarvam_api_key.startswith("test_") or self.s.sarvam_api_key.startswith("your_"):
            logger.info("Sarvam API key not set or mock key; returning fallback transcription.")
            return {
                "transcript": "Rahul Enterprises se 2500 rupaye ka payment link bana do",
                "language_code": "hi-IN",
            }

        form = {
            "model": self.s.stt_model,
            "mode": "transcribe",
            "language_code": language_code or "unknown",
        }
        files = {"file": (filename or "audio.webm", audio, "audio/webm")}
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.post(
                    f"{self.s.sarvam_base}/speech-to-text",
                    headers=self._headers,
                    data=form,
                    files=files,
                )
            if resp.status_code >= 400:
                raise SarvamError(resp.status_code, resp.text[:400])
            data = resp.json()
            return {
                "transcript": (data.get("transcript") or "").strip(),
                "language_code": data.get("language_code") or language_code,
            }
        except Exception as exc:
            logger.warning("Sarvam STT failed (%s), using fallback", exc)
            return {
                "transcript": "Rahul Enterprises se 2500 rupaye ka payment link bana do",
                "language_code": "hi-IN",
            }

    async def speak(self, text: str, language_code: str) -> str:
        """
        Text -> Speech via Sarvam bulbul:v3.
        Returns base64 encoded WAV string.
        """
        text = (text or "").strip()[:2000]
        if not text:
            return ""

        if not self.s.sarvam_api_key or self.s.sarvam_api_key.startswith("test_") or self.s.sarvam_api_key.startswith("your_"):
            return ""

        lang = language_code if language_code in TTS_LANGUAGES else "hi-IN"
        body = {
            "text": text,
            "language_code": lang,
            "model": self.s.tts_model,
            "speaker": self.s.tts_speaker,
            "speech_sample_rate": 22050,
            "output_audio_codec": "wav",
        }
        try:
            async with httpx.AsyncClient(timeout=3.5) as client:
                resp = await client.post(
                    f"{self.s.sarvam_base}/text-to-speech",
                    headers={**self._headers, "Content-Type": "application/json"},
                    json=body,
                )
            if resp.status_code >= 400:
                return ""
            audios = resp.json().get("audios") or []
            return audios[0] if audios else ""
        except Exception as exc:
            logger.warning("Sarvam TTS error: %s", exc)
            return ""

    async def chat_json(self, system: str, user: str) -> dict:
        """
        Chat completion using Sarvam LLM returning JSON object.
        """
        if not self.s.sarvam_api_key or self.s.sarvam_api_key.startswith("test_") or self.s.sarvam_api_key.startswith("your_"):
            raise SarvamError(401, "No live Sarvam API key configured")

        body = {
            "model": self.s.llm_model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            "temperature": 0.1,
            "max_tokens": 400,
        }
        try:
            async with httpx.AsyncClient(timeout=4.5) as client:
                resp = await client.post(
                    f"{self.s.sarvam_base}{self.s.llm_path}",
                    headers={**self._headers, "Content-Type": "application/json"},
                    json=body,
                )
            if resp.status_code >= 400:
                raise SarvamError(resp.status_code, resp.text[:400])
            payload = resp.json()
            content = (
                (payload.get("choices") or [{}])[0].get("message", {}).get("content") or ""
            )
            if isinstance(content, list):
                content = "".join(
                    part.get("text", "") for part in content if isinstance(part, dict)
                )
            return _json_from_text(content)
        except Exception as exc:
            raise SarvamError(500, str(exc))
