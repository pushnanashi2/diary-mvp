import os, re, glob
from dataclasses import dataclass

def _read_lines(path: str) -> list[str]:
    out = []
    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            s = line.strip()
            if not s or s.startswith("#"):
                continue
            out.append(s)
    return out

def _read_text(path: str) -> str:
    with open(path, "r", encoding="utf-8") as f:
        return f.read().strip()

@dataclass(frozen=True)
class TextResources:
    filler_patterns: list[re.Pattern]
    pii_email_patterns: list[re.Pattern]
    pii_phone_patterns: list[re.Pattern]
    ng_topic_patterns: list[re.Pattern]
    non_save_patterns: list[re.Pattern]
    entry_summary_system: str
    entry_summary_user_tpl: str
    range_summary_user_templates: dict[str, str]  # template_id -> tpl

def load_resources(resources_dir: str) -> TextResources:
    filler_patterns = [re.compile(p) for p in _read_lines(os.path.join(resources_dir, "fillers_ja.txt"))]
    pii_email_patterns = [re.compile(p) for p in _read_lines(os.path.join(resources_dir, "pii_email.txt"))]
    pii_phone_patterns = [re.compile(p) for p in _read_lines(os.path.join(resources_dir, "pii_phone_ja.txt"))]
    ng_topic_patterns = [re.compile(p) for p in _read_lines(os.path.join(resources_dir, "ng_topics.txt"))]
    non_save_patterns = [re.compile(p) for p in _read_lines(os.path.join(resources_dir, "non_save_words.txt"))]

    prompts_dir = os.path.join(resources_dir, "prompts")
    entry_sys = _read_text(os.path.join(prompts_dir, "entry_summary_system.txt"))
    entry_user = _read_text(os.path.join(prompts_dir, "entry_summary_user.txt"))

    templates: dict[str, str] = {}
    templates["default"] = _read_text(os.path.join(prompts_dir, "range_summary_user.txt"))
    for p in glob.glob(os.path.join(prompts_dir, "range_summary_user__*.txt")):
        name = os.path.basename(p)
        template_id = name[len("range_summary_user__"):-len(".txt")]
        templates[template_id] = _read_text(p)

    return TextResources(
        filler_patterns=filler_patterns,
        pii_email_patterns=pii_email_patterns,
        pii_phone_patterns=pii_phone_patterns,
        ng_topic_patterns=ng_topic_patterns,
        non_save_patterns=non_save_patterns,
        entry_summary_system=entry_sys,
        entry_summary_user_tpl=entry_user,
        range_summary_user_templates=templates,
    )
