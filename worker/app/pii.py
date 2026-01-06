from dataclasses import dataclass
import re
import unicodedata

@dataclass(frozen=True)
class PiiResult:
    masked_text: str
    types: list[str]
    counts: dict[str, int]

def normalize_for_pii(text: str) -> str:
    t = text or ""
    # 全角→半角、全角記号なども寄せる
    t = unicodedata.normalize("NFKC", t)

    # ダッシュ類を普通のハイフンに寄せる（STTで混ざりがち）
    dash_chars = ["‐","‑","‒","–","—","−","ー","―"]
    for ch in dash_chars:
        t = t.replace(ch, "-")

    return t

def _apply_patterns(text: str, patterns: list[re.Pattern], label: str):
    cnt = 0
    def repl(m):
        nonlocal cnt
        cnt += 1
        return f"[{label}]"
    out = text
    for p in patterns:
        out = p.sub(repl, out)
    return out, cnt

def detect_and_mask(text: str, email_patterns: list[re.Pattern], phone_patterns: list[re.Pattern]) -> PiiResult:
    t = normalize_for_pii(text)

    types = []
    counts = {}

    t2, phone_cnt = _apply_patterns(t, phone_patterns, "PHONE")
    if phone_cnt > 0:
        types.append("phone")
        counts["phone"] = phone_cnt

    t3, email_cnt = _apply_patterns(t2, email_patterns, "EMAIL")
    if email_cnt > 0:
        types.append("email")
        counts["email"] = email_cnt

    return PiiResult(masked_text=t3, types=types, counts=counts)
