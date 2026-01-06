import re

def clean_transcript(text: str, filler_patterns: list[re.Pattern]) -> str:
    t = text or ""
    for pat in filler_patterns:
        t = pat.sub("", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t
