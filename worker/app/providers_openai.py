import io
from openai import OpenAI

def make_client(api_key: str) -> OpenAI:
    return OpenAI(api_key=api_key, timeout=90.0, max_retries=0)

def stt(client: OpenAI, audio_bytes: bytes, filename: str) -> str:
    f = io.BytesIO(audio_bytes)
    f.name = filename
    resp = client.audio.transcriptions.create(model="whisper-1", file=f)
    return resp.text

def chat_summary(client: OpenAI, system_prompt: str | None, user_prompt: str) -> str:
    msgs = []
    if system_prompt:
        msgs.append({"role":"system","content":system_prompt})
    msgs.append({"role":"user","content":user_prompt})
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=msgs,
        temperature=0.3
    )
    return resp.choices[0].message.content.strip()
