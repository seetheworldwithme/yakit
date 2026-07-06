#!/usr/bin/env python3
"""Detect whether two frontend projects are a trivial reskin of the same codebase.

Independence-score model (higher = more independent / safer for bidding):
  total 100 = Σ dimension points; dimension points = weight * (1 - overlap).
  Tiers: >=70 independent (bid-safe) | 40-69 partial-reuse | <=39 likely-reskin.
  Identity override: same git origin or same package name + major version caps
  the total at 39 (forced likely-reskin), because such identity is impossible
  to explain away as coincidence under a code audit.

The extraction layer reads both trees (skipping node_modules/dist/build/.git)
and lifts per-dimension overlap signals. Scoring, remediation, and reporting
are layered on top. Stdlib only.
"""

from __future__ import annotations

import argparse
import datetime
import difflib
import hashlib
import json
import math
import os
import re
import subprocess
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable


# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #

DEFAULT_CONFIG: dict[str, Any] = {
    # dimension weights double as "满分" (points). Must sum to 100.
    "weights": {"skeleton": 25, "layout": 30, "visual": 25, "logic": 20},
    # independence tiers (>=70 bid-safe target). identity_cap overrides total.
    "tiers": {
        "independent_min": 70,
        "partial_min": 40,
        "identity_cap": 39,
    },
    # single-dimension overlap signals that escalate risk independent of total.
    "high_risk_overlap_signals": {
        "skeleton_core": 70,
        "layout_structure": 65,
    },
    "remediation": {
        "target_overlap": 0.15,  # overlap floor for "independent" recoverable points
        "submetric_trigger": 0.30,  # only emit advice for submetrics above this overlap
        "priority_thresholds": [5.0, 3.0, 1.5, 0.5],  # P0/P1/P2/P3 recoverable cutoffs
    },
    "identity_override": {
        # cap total at tiers.identity_cap when these match (non-empty & equal)
        "same_git_origin": True,
        "same_package_name_and_major": True,
    },
    "max_file_size_bytes": 1_048_576,
    "ignore_dirs": [
        ".git",
        ".hg",
        ".svn",
        ".next",
        ".nuxt",
        ".svelte-kit",
        ".turbo",
        ".cache",
        "coverage",
        "dist",
        "build",
        "out",
        "node_modules",
        "vendor",
        "public/assets",
        # tooling / non-product directories that would contaminate the frontend
        # fingerprint if scanned (skills, their tests/fixtures, agent config).
        ".agents",
        ".claude",
    ],
    "include_extensions": [
        ".ts",
        ".tsx",
        ".js",
        ".jsx",
        ".mjs",
        ".cjs",
        ".vue",
        ".svelte",
        ".html",
        ".css",
        ".scss",
        ".sass",
        ".less",
        ".json",
        ".yaml",
        ".yml",
        ".toml",
        ".config",
    ],
    "important_filenames": [
        "package.json",
        "vite.config.ts",
        "vite.config.js",
        "webpack.config.js",
        "webpack.config.ts",
        "next.config.js",
        "next.config.mjs",
        "nuxt.config.ts",
        "svelte.config.js",
        "angular.json",
        "tsconfig.json",
        "jsconfig.json",
        ".eslintrc",
        ".eslintrc.js",
        ".eslintrc.json",
        ".prettierrc",
        ".prettierrc.js",
        "tailwind.config.js",
        "tailwind.config.ts",
        "postcss.config.js",
    ],
}

# Single source of truth for dimensions, submetric shares, labels, and the
# remediation "kind" that maps each submetric to an actionable template.
# submetric tuple: (key, label_zh, share, action_kind)
DIMENSION_META: dict[str, dict[str, Any]] = {
    "skeleton": {
        "label_zh": "技术骨架",
        "label_en": "Project skeleton",
        "submetrics": [
            ("dependency_version_overlap", "依赖版本重叠", 20, "dependency_version"),
            ("framework_build_overlap", "框架/构建重叠", 15, "framework"),
            ("directory_structure_overlap", "目录结构重叠", 20, "directory"),
            ("route_configuration_overlap", "路由/配置重叠", 20, "route"),
            ("state_management_overlap", "状态管理重叠", 15, "state"),
            ("engineering_config_similarity", "工程配置相似度", 10, "engineering_config"),
        ],
    },
    "layout": {
        "label_zh": "页面布局",
        "label_en": "Page layout",
        "submetrics": [
            ("component_hierarchy_overlap", "组件层级/标签序列重叠", 30, "hierarchy"),
            ("page_section_class_overlap", "页面分区/class 命名重叠", 20, "class"),
            ("shared_component_implementation_overlap", "共享组件实现重叠", 25, "component_impl"),
            ("responsive_logic_overlap", "响应式/断点逻辑重叠", 15, "responsive"),
            ("layout_utility_pattern_overlap", "布局工具模式重叠", 10, "layout_util"),
        ],
    },
    "visual": {
        "label_zh": "视觉体系",
        "label_en": "Visual system",
        "submetrics": [
            ("color_system_overlap", "配色系统重叠", 30, "color"),
            ("typography_scale_overlap", "字体比例重叠", 25, "typography"),
            ("spacing_scale_overlap", "间距比例重叠", 20, "spacing"),
            ("motion_rule_overlap", "动效规则重叠", 15, "motion"),
            ("design_token_name_overlap", "设计 token 命名重叠", 10, "token_name"),
        ],
    },
    "logic": {
        "label_zh": "业务逻辑",
        "label_en": "Business logic",
        "submetrics": [
            ("business_logic_token_overlap", "业务逻辑 token 重叠", 35, "logic_token"),
            ("third_party_service_config_overlap", "第三方服务配置重叠", 25, "service"),
            ("api_endpoint_integration_overlap", "API 端点/集成重叠", 20, "endpoint"),
            ("utility_function_overlap", "工具函数指纹重叠", 20, "utility"),
        ],
    },
}

# Actionable, submetric-specific guidance. "回收" = independence points recovered.
ACTION_TEMPLATES: dict[str, str] = {
    "dependency_version": "核心依赖升大版本或替换等价库（axios→ky/fetch、zustand→jotai、antd→@mui/自研、moment↔dayjs），打散依赖版本指纹。",
    "framework": "调整构建/框架选型或构建配置（CRA↔Vite↔Next、webpack↔vite、tsconfig 严格度），改 build 工具链指纹。",
    "directory": "重组顶层目录命名与层级（pages→views、components→ui、store→state、utils→lib），改变目录签名。",
    "route": "重构路由表组织（集中式↔约定式、改 path 命名风格、拆分路由模块），打散路由指纹。",
    "state": "替换状态管理库或重构 store 切片边界与命名（zustand↔jotai↔redux-toolkit）。",
    "engineering_config": "替换 lint/format/prettier/eslint 规则集与 npm scripts 命名、husky/commitlint 配置。",
    "hierarchy": "重排主框架/首页布局结构（双栏↔栅格↔Tab↔卡片墙），重命名容器组件，拆/合页面，打散 JSX 标签序列。",
    "class": "全量重命名页面 class/分区语义类名（BEM↔utility↔css-modules），改 class 指纹。",
    "component_impl": "重写共享组件实现细节（props 形态、内部结构、默认值、文件位置），消除组件指纹碰撞。",
    "responsive": "重构响应式策略（断点定义↔container query↔clamp），改断点指纹。",
    "layout_util": "替换/重命名布局工具函数（间距/栅格/flex 辅助），改布局工具指纹。",
    "color": "更换主色相并重建色板，迁移到独立 token 命名空间（旧名仅作兼容别名）。",
    "typography": "重建字体比例与字族选型（modular scale↔固定档、换字体族），改字体指纹。",
    "spacing": "重建间距比例（8pt↔4pt↔baseline grid），改间距指纹。",
    "motion": "重建动效规则（时长/缓动/keyframes），沉淀为独立 motion token。",
    "token_name": "全量重命名 CSS 变量/设计 token 到独立命名空间（如 --App-*→自有前缀）。",
    "logic_token": "重构业务模块命名与控制流（函数拆分、改写算法实现、调整调用层次），打散逻辑 token 指纹。",
    "service": "替换/封装第三方服务集成（Sentry→自研、axios→fetch 封装、换埋点 SDK），改服务指纹。",
    "endpoint": "重构请求层封装与 URL 命名风格（REST↔RPC、path 命名、query 风格）。",
    "utility": "替换/提取工具集，改函数签名与命名风格。",
}

STYLE_EXTENSIONS = {".css", ".scss", ".sass", ".less", ".vue", ".svelte", ".tsx", ".jsx", ".html"}
CODE_EXTENSIONS = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".vue", ".svelte"}
LAYOUT_EXTENSIONS = {".tsx", ".jsx", ".vue", ".svelte", ".html"}
CONFIG_EXTENSIONS = {".json", ".yaml", ".yml", ".toml", ".config"}

TOKEN_RE = re.compile(r"[A-Za-z_$][\w$-]*|\d+(?:\.\d+)?")
ROUTE_RE = re.compile(r"(?:path|route|to|href)\s*[:=]\s*[\"'`]([^\"'`]+)[\"'`]")
IMPORT_RE = re.compile(r"from\s+[\"']([^\"']+)[\"']|require\([\"']([^\"']+)[\"']\)")
FUNCTION_RE = re.compile(r"(?:function\s+|const\s+|let\s+|var\s+|export\s+function\s+)([A-Za-z_$][\w$]*)")
TAG_RE = re.compile(r"</?([A-Za-z][A-Za-z0-9_.:-]*)\b")
CLASS_RE = re.compile(r"(?:className|class)\s*=\s*[\"'`]([^\"'`]+)[\"'`]")
COLOR_RE = re.compile(
    r"#(?:[0-9a-fA-F]{3,8})\b|rgba?\([^)]+\)|hsla?\([^)]+\)|var\(--[A-Za-z0-9_-]*(?:color|Color|Colors)[A-Za-z0-9_-]*\)"
)
CSS_VAR_RE = re.compile(r"--[A-Za-z0-9_-]+")
TYPO_RE = re.compile(r"(font-size|line-height|font-weight|font-family)\s*:\s*([^;}\n]+)")
SPACING_RE = re.compile(r"(?:margin|padding|gap|row-gap|column-gap)(?:-[a-z]+)?\s*:\s*([^;}\n]+)")
MOTION_RE = re.compile(r"(transition|animation|@keyframes)\s*[:\s]\s*([^;{\n}]*)")
ENDPOINT_RE = re.compile(r"[\"'`](https?://[^\"'`]+|/[A-Za-z0-9_./:{}-]+)[\"'`]")
SERVICE_RE = re.compile(r"\b(Sentry|Firebase|Supabase|Stripe|GoogleAnalytics|gtag|amplitude|mixpanel|axios|fetch|GraphQL|Apollo)\b", re.I)
BREAKPOINT_RE = re.compile(r"@media[^{]+|\b(useMediaQuery|matchMedia|Breakpoint|breakpoints|sm:|md:|lg:|xl:)\b")


@dataclass
class FileRecord:
    rel: str
    path: Path
    ext: str
    text: str
    size: int
    sha1: str
    normalized_sha1: str


# --------------------------------------------------------------------------- #
# Extraction layer (project tree -> analyzed signals)
# --------------------------------------------------------------------------- #

def clamp(value: float, lower: float = 0, upper: float = 100) -> float:
    return max(lower, min(upper, value))


def percent(value: float) -> float:
    return round(clamp(value * 100), 2)


def normalize_text(text: str) -> str:
    text = re.sub(r"/\*.*?\*/", " ", text, flags=re.S)
    text = re.sub(r"//.*", " ", text)
    text = re.sub(r"#.*", " ", text)
    text = re.sub(r"\s+", " ", text)
    return text.strip().lower()


def sha1_text(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8", errors="ignore")).hexdigest()


def read_text(path: Path) -> str:
    try:
        return path.read_text(encoding="utf-8", errors="ignore")
    except UnicodeDecodeError:
        return path.read_text(errors="ignore")


def is_ignored(path: Path, root: Path, config: dict[str, Any]) -> bool:
    rel_parts = path.relative_to(root).parts
    ignore_dirs = set(config["ignore_dirs"])
    return any(part in ignore_dirs or "/".join(rel_parts[: idx + 1]) in ignore_dirs for idx, part in enumerate(rel_parts))


def iter_project_files(root: Path, config: dict[str, Any]) -> list[FileRecord]:
    max_size = int(config["max_file_size_bytes"])
    include_ext = set(config["include_extensions"])
    important = set(config["important_filenames"])
    records: list[FileRecord] = []
    for dirpath, dirnames, filenames in os.walk(root):
        current = Path(dirpath)
        dirnames[:] = [name for name in dirnames if not is_ignored(current / name, root, config)]
        for filename in filenames:
            path = current / filename
            if is_ignored(path, root, config):
                continue
            ext = path.suffix
            if ext not in include_ext and filename not in important:
                continue
            try:
                size = path.stat().st_size
            except OSError:
                continue
            if size > max_size:
                continue
            text = read_text(path)
            rel = path.relative_to(root).as_posix()
            normalized = normalize_text(text)
            records.append(
                FileRecord(
                    rel=rel,
                    path=path,
                    ext=ext,
                    text=text,
                    size=size,
                    sha1=sha1_text(text),
                    normalized_sha1=sha1_text(normalized),
                )
            )
    return records


def tokens(text: str) -> list[str]:
    return [item.lower() for item in TOKEN_RE.findall(normalize_text(text))]


def token_counter(records: Iterable[FileRecord], extensions: set[str] | None = None) -> Counter[str]:
    counter: Counter[str] = Counter()
    for record in records:
        if extensions is not None and record.ext not in extensions:
            continue
        counter.update(tokens(record.text))
    return counter


def weighted_jaccard(a: Counter[str], b: Counter[str]) -> float:
    keys = set(a) | set(b)
    if not keys:
        return 0
    numerator = sum(min(a[key], b[key]) for key in keys)
    denominator = sum(max(a[key], b[key]) for key in keys)
    return numerator / denominator if denominator else 0


def jaccard(a: Iterable[Any], b: Iterable[Any]) -> float:
    set_a = set(a)
    set_b = set(b)
    if not set_a and not set_b:
        return 0
    return len(set_a & set_b) / len(set_a | set_b)


def top_common(a: Iterable[Any], b: Iterable[Any], limit: int = 20) -> list[Any]:
    return sorted(set(a) & set(b))[:limit]


def sequence_similarity(a: list[str], b: list[str]) -> float:
    if not a or not b:
        return 0
    return difflib.SequenceMatcher(None, a, b).ratio()


def load_package(records: list[FileRecord]) -> dict[str, Any]:
    package = next((record for record in records if record.rel == "package.json"), None)
    if not package:
        return {}
    try:
        return json.loads(package.text)
    except json.JSONDecodeError:
        return {}


def git_value(root: Path, *args: str) -> str:
    try:
        result = subprocess.run(
            ["git", "-C", str(root), *args],
            check=False,
            capture_output=True,
            text=True,
            timeout=3,
        )
    except (OSError, subprocess.SubprocessError):
        return ""
    if result.returncode != 0:
        return ""
    return result.stdout.strip()


def project_identity(root: Path, package: dict[str, Any]) -> dict[str, str]:
    return {
        "package_name": str(package.get("name", "")),
        "package_version": str(package.get("version", "")),
        "git_origin": git_value(root, "config", "--get", "remote.origin.url"),
        "git_branch": git_value(root, "branch", "--show-current"),
        "git_head": git_value(root, "rev-parse", "--short", "HEAD"),
    }


def dependencies(package: dict[str, Any]) -> dict[str, str]:
    deps: dict[str, str] = {}
    for key in ("dependencies", "devDependencies", "peerDependencies", "optionalDependencies"):
        value = package.get(key)
        if isinstance(value, dict):
            deps.update({str(name): str(version) for name, version in value.items()})
    return deps


def major_version(version: str) -> str:
    match = re.search(r"(\d+)", version)
    return match.group(1) if match else version


def detect_frameworks(deps: dict[str, str]) -> set[str]:
    candidates = {
        "react": ["react", "react-dom", "next", "gatsby", "umi"],
        "vue": ["vue", "nuxt", "@vue/cli-service", "vitepress"],
        "svelte": ["svelte", "@sveltejs/kit"],
        "angular": ["@angular/core", "@angular/cli"],
        "vite": ["vite"],
        "webpack": ["webpack"],
        "tailwind": ["tailwindcss"],
        "antd": ["antd", "@ant-design/icons"],
        "material-ui": ["@mui/material", "@material-ui/core"],
    }
    found = set()
    for framework, names in candidates.items():
        if any(name in deps for name in names):
            found.add(framework)
    return found


def detect_state(deps: dict[str, str], records: list[FileRecord]) -> set[str]:
    names = {"redux", "@reduxjs/toolkit", "mobx", "zustand", "pinia", "vuex", "recoil", "jotai", "xstate"}
    found = {name for name in names if name in deps}
    import_tokens = set()
    for record in records:
        if record.ext in CODE_EXTENSIONS:
            for match in IMPORT_RE.findall(record.text):
                import_tokens.update(item for item in match if item)
    found.update(name for name in names if name in import_tokens)
    return found


def directory_signature(records: list[FileRecord]) -> set[str]:
    signature = set()
    for record in records:
        parts = record.rel.split("/")
        for index in range(1, min(len(parts), 4)):
            signature.add("/".join(parts[:index]))
        if len(parts) > 1:
            signature.add(f"{'/'.join(parts[:-1])}/*{record.ext}")
    return signature


# Path-role visibility weights. Layout/page/entry files define the rendered
# skeleton a bidder actually sees, so they count more; plumbing (utils/hooks/
# store/services/lib/...) does not render screens and counts less. This stops
# long-tail utility files from dominating the "page layout similarity" signal
# and makes the metric respond proportionally to partial restructuring (the
# previous top-K mean hid incremental progress behind a 100% cliff).
_PLUMBING_DIRS = {
    "utils", "util", "hooks", "hook", "store", "stores", "services", "service",
    "lib", "libs", "helpers", "helper", "constants", "enums", "types",
    "interfaces", "models", "api", "schemas",
}
_SURFACE_DIRS = {
    "pages", "page", "layout", "layouts", "routes", "route", "router",
    "routers", "shell",
}
_SURFACE_NAME = re.compile(
    r"^(index|app|newapp|childnewapp|.*app|.*layout|.*shell|.*workspace|mainoperator)\.(tsx|jsx|vue|svelte)$",
    re.I,
)


def visibility_weight(rel: str) -> float:
    segs = rel.lower().split("/")
    if any(seg in _PLUMBING_DIRS for seg in segs):
        return 0.3
    if any(seg in _SURFACE_DIRS for seg in segs) or _SURFACE_NAME.match(segs[-1]):
        return 3.0
    return 1.0



def config_records(records: list[FileRecord], config: dict[str, Any]) -> list[FileRecord]:
    important = set(config["important_filenames"])
    return [record for record in records if Path(record.rel).name in important or record.ext in CONFIG_EXTENSIONS]


def extract_routes(records: list[FileRecord]) -> Counter[str]:
    counter: Counter[str] = Counter()
    for record in records:
        name = record.rel.lower()
        if record.ext in CODE_EXTENSIONS or "route" in name or "router" in name:
            for route in ROUTE_RE.findall(record.text):
                if route and not route.startswith(("http://", "https://", "#")):
                    counter[route.lower()] += 1
    return counter


def extract_tag_sequences(records: list[FileRecord]) -> dict[str, list[str]]:
    sequences: dict[str, list[str]] = {}
    for record in records:
        if record.ext not in LAYOUT_EXTENSIONS:
            continue
        tags = [tag.lower() for tag in TAG_RE.findall(record.text)]
        if tags:
            sequences[record.rel] = tags[:500]
    return sequences


def best_sequence_matches(a: dict[str, list[str]], b: dict[str, list[str]], limit: int = 10) -> tuple[float, list[dict[str, Any]]]:
    matches: list[dict[str, Any]] = []
    weighted_sum = 0.0
    weight_total = 0.0
    for rel_a, seq_a in a.items():
        weight = visibility_weight(rel_a)
        weight_total += weight
        best = ("", 0.0)
        for rel_b, seq_b in b.items():
            score = sequence_similarity(seq_a, seq_b)
            if score > best[1]:
                best = (rel_b, score)
        weighted_sum += weight * best[1]
        if best[1] > 0:
            matches.append({"project_a": rel_a, "project_b": best[0], "overlap": percent(best[1]), "weight": weight})
    matches.sort(key=lambda item: item["overlap"], reverse=True)
    aggregate = percent(weighted_sum / weight_total) if weight_total else 0
    return round(aggregate, 2), matches[:limit]


def extract_classes(records: list[FileRecord]) -> Counter[str]:
    counter: Counter[str] = Counter()
    for record in records:
        if record.ext not in LAYOUT_EXTENSIONS and record.ext not in STYLE_EXTENSIONS:
            continue
        for class_blob in CLASS_RE.findall(record.text):
            for class_name in re.split(r"\s+", class_blob):
                if class_name:
                    counter[class_name.lower()] += 1
        if record.ext in {".css", ".scss", ".sass", ".less"}:
            for selector in re.findall(r"\.([A-Za-z_-][\w-]*)", record.text):
                counter[selector.lower()] += 1
    return counter


def component_fingerprints(records: list[FileRecord]) -> dict[str, str]:
    result = {}
    for record in records:
        parts = record.rel.split("/")
        if "components" not in parts and "component" not in record.rel.lower():
            continue
        if record.ext not in CODE_EXTENSIONS and record.ext not in STYLE_EXTENSIONS:
            continue
        normalized = re.sub(r"[\"'`][^\"'`]*[\"'`]", "STRING", normalize_text(record.text))
        normalized = re.sub(r"\b\d+(?:\.\d+)?\b", "NUMBER", normalized)
        result[record.rel] = sha1_text(normalized)
    return result


def extract_regex_counter(records: list[FileRecord], pattern: re.Pattern[str], extensions: set[str] | None = None) -> Counter[str]:
    counter: Counter[str] = Counter()
    for record in records:
        if extensions is not None and record.ext not in extensions:
            continue
        for match in pattern.findall(record.text):
            if isinstance(match, tuple):
                value = " ".join(part for part in match if part).strip()
            else:
                value = match.strip()
            if value:
                normalized = re.sub(r"\s+", " ", value.strip().lower())
                if normalized:
                    counter[normalized] += 1
    return counter


def style_property_counter(records: list[FileRecord], pattern: re.Pattern[str]) -> Counter[str]:
    counter: Counter[str] = Counter()
    for record in records:
        if record.ext not in STYLE_EXTENSIONS:
            continue
        for match in pattern.findall(record.text):
            if isinstance(match, tuple):
                value = ":".join(part.strip().lower() for part in match if part.strip())
            else:
                value = match.strip().lower()
            counter[value] += 1
    return counter


def file_similarity_by_name(a: list[FileRecord], b: list[FileRecord], names: Iterable[str] | None = None) -> tuple[float, list[dict[str, Any]]]:
    by_b = {record.rel: record for record in b}
    rows = []
    allowed = set(names) if names else None
    for record_a in a:
        if allowed is not None and Path(record_a.rel).name not in allowed:
            continue
        record_b = by_b.get(record_a.rel)
        if not record_b:
            continue
        score = difflib.SequenceMatcher(None, normalize_text(record_a.text), normalize_text(record_b.text)).ratio()
        rows.append({"path": record_a.rel, "overlap": percent(score)})
    rows.sort(key=lambda item: item["overlap"], reverse=True)
    aggregate = sum(item["overlap"] for item in rows) / len(rows) if rows else 0
    return round(aggregate, 2), rows[:20]


def compare_dependency_versions(a: dict[str, str], b: dict[str, str]) -> tuple[float, list[dict[str, str]]]:
    rows = []
    for name in sorted(set(a) & set(b)):
        exact = a[name] == b[name]
        same_major = major_version(a[name]) == major_version(b[name])
        rows.append({"name": name, "project_a": a[name], "project_b": b[name], "match": "exact" if exact else "major" if same_major else "name"})
    if not a and not b:
        return 0, []
    score = sum(1.0 if row["match"] == "exact" else 0.75 if row["match"] == "major" else 0.45 for row in rows)
    denominator = max(len(a), len(b), 1)
    return percent(score / denominator), rows[:50]


def weighted_average(parts: dict[str, tuple[float, float]]) -> float:
    total_weight = sum(weight for _, weight in parts.values())
    if not total_weight:
        return 0
    value = sum(score * weight for score, weight in parts.values()) / total_weight
    return round(value, 2)


def analyze_project(root: Path, config: dict[str, Any]) -> dict[str, Any]:
    records = iter_project_files(root, config)
    package = load_package(records)
    deps = dependencies(package)
    return {
        "root": str(root),
        "records": records,
        "file_count": len(records),
        "total_bytes": sum(record.size for record in records),
        "package": package,
        "identity": project_identity(root, package),
        "dependencies": deps,
        "frameworks": detect_frameworks(deps),
        "state": detect_state(deps, records),
        "directories": directory_signature(records),
        "routes": extract_routes(records),
        "configs": config_records(records, config),
        "tag_sequences": extract_tag_sequences(records),
        "classes": extract_classes(records),
        "component_fingerprints": component_fingerprints(records),
        "colors": extract_regex_counter(records, COLOR_RE, STYLE_EXTENSIONS),
        "css_vars": extract_regex_counter(records, CSS_VAR_RE, STYLE_EXTENSIONS),
        "typography": style_property_counter(records, TYPO_RE),
        "spacing": style_property_counter(records, SPACING_RE),
        "motion": style_property_counter(records, MOTION_RE),
        "breakpoints": extract_regex_counter(records, BREAKPOINT_RE, STYLE_EXTENSIONS | CODE_EXTENSIONS),
        "endpoints": extract_regex_counter(records, ENDPOINT_RE, CODE_EXTENSIONS | CONFIG_EXTENSIONS),
        "services": extract_regex_counter(records, SERVICE_RE, CODE_EXTENSIONS | CONFIG_EXTENSIONS),
        "functions": extract_regex_counter(records, FUNCTION_RE, CODE_EXTENSIONS),
        "logic_tokens": token_counter(records, CODE_EXTENSIONS),
        "style_tokens": token_counter(records, STYLE_EXTENSIONS),
    }


# --------------------------------------------------------------------------- #
# Dimension overlap scoring (0-100 overlap per dimension; reused extraction)
# --------------------------------------------------------------------------- #

def dimension_skeleton(a: dict[str, Any], b: dict[str, Any], config: dict[str, Any]) -> tuple[float, dict[str, Any]]:
    dep_score, dep_matches = compare_dependency_versions(a["dependencies"], b["dependencies"])
    framework_score = percent(jaccard(a["frameworks"], b["frameworks"]))
    dir_score = percent(jaccard(a["directories"], b["directories"]))
    route_score = percent(weighted_jaccard(a["routes"], b["routes"]))
    state_score = percent(jaccard(a["state"], b["state"]))
    config_score, config_matches = file_similarity_by_name(a["configs"], b["configs"], config["important_filenames"])
    submetrics = {
        "dependency_version_overlap": (dep_score, 20),
        "framework_build_overlap": (framework_score, 15),
        "directory_structure_overlap": (dir_score, 20),
        "route_configuration_overlap": (route_score, 20),
        "state_management_overlap": (state_score, 15),
        "engineering_config_similarity": (config_score, 10),
    }
    score = weighted_average(submetrics)
    evidence = {
        "matched_dependencies": dep_matches,
        "matched_frameworks": sorted(set(a["frameworks"]) & set(b["frameworks"])),
        "matched_state_libraries": sorted(set(a["state"]) & set(b["state"])),
        "matched_directories": top_common(a["directories"], b["directories"], 30),
        "matched_routes": top_common(a["routes"].keys(), b["routes"].keys(), 30),
        "matching_config_files": config_matches,
    }
    return score, {"overlap": score, "submetrics": {key: value[0] for key, value in submetrics.items()}, "evidence": evidence}


def dimension_layout(a: dict[str, Any], b: dict[str, Any]) -> tuple[float, dict[str, Any]]:
    hierarchy_score, hierarchy_matches = best_sequence_matches(a["tag_sequences"], b["tag_sequences"])
    section_score = percent(weighted_jaccard(a["classes"], b["classes"]))
    fp_a = a["component_fingerprints"]
    fp_b = b["component_fingerprints"]
    hashes_a = set(fp_a.values())
    # visibility-weighted collision rate: a colliding page/layout component
    # (high visibility) weighs far more than a colliding internal helper.
    collision_weight = sum(visibility_weight(path) for path, hash_b in fp_b.items() if hash_b in hashes_a)
    total_weight = sum(visibility_weight(path) for path in fp_b)
    component_score = percent(collision_weight / total_weight) if total_weight else 0
    common_hashes = set(fp_a.values()) & set(fp_b.values())
    responsive_score = percent(weighted_jaccard(a["breakpoints"], b["breakpoints"]))
    layout_utility_score = percent(weighted_jaccard(a["style_tokens"], b["style_tokens"]))
    submetrics = {
        "component_hierarchy_overlap": (hierarchy_score, 30),
        "page_section_class_overlap": (section_score, 20),
        "shared_component_implementation_overlap": (component_score, 25),
        "responsive_logic_overlap": (responsive_score, 15),
        "layout_utility_pattern_overlap": (layout_utility_score, 10),
    }
    score = weighted_average(submetrics)
    matching_components = []
    for path_a, hash_a in fp_a.items():
        if hash_a in common_hashes:
            for path_b, hash_b in fp_b.items():
                if hash_a == hash_b:
                    matching_components.append({"project_a": path_a, "project_b": path_b, "fingerprint": hash_a[:12]})
                    break
    evidence = {
        "hierarchy_matches": hierarchy_matches,
        "matched_section_or_class_names": top_common(a["classes"].keys(), b["classes"].keys(), 40),
        "matching_component_fingerprints": matching_components[:20],
        "matched_breakpoint_patterns": top_common(a["breakpoints"].keys(), b["breakpoints"].keys(), 30),
    }
    return score, {"overlap": score, "submetrics": {key: value[0] for key, value in submetrics.items()}, "evidence": evidence}


def dimension_visual(a: dict[str, Any], b: dict[str, Any]) -> tuple[float, dict[str, Any]]:
    color_score = percent(weighted_jaccard(a["colors"], b["colors"]))
    typography_score = percent(weighted_jaccard(a["typography"], b["typography"]))
    spacing_score = percent(weighted_jaccard(a["spacing"], b["spacing"]))
    motion_score = percent(weighted_jaccard(a["motion"], b["motion"]))
    css_var_score = percent(weighted_jaccard(a["css_vars"], b["css_vars"]))
    submetrics = {
        "color_system_overlap": (color_score, 30),
        "typography_scale_overlap": (typography_score, 25),
        "spacing_scale_overlap": (spacing_score, 20),
        "motion_rule_overlap": (motion_score, 15),
        "design_token_name_overlap": (css_var_score, 10),
    }
    score = weighted_average(submetrics)
    evidence = {
        "matched_colors": top_common(a["colors"].keys(), b["colors"].keys(), 40),
        "matched_typography_rules": top_common(a["typography"].keys(), b["typography"].keys(), 30),
        "matched_spacing_rules": top_common(a["spacing"].keys(), b["spacing"].keys(), 30),
        "matched_motion_rules": top_common(a["motion"].keys(), b["motion"].keys(), 30),
        "matched_css_variables": top_common(a["css_vars"].keys(), b["css_vars"].keys(), 40),
    }
    return score, {"overlap": score, "submetrics": {key: value[0] for key, value in submetrics.items()}, "evidence": evidence}


def dimension_logic(a: dict[str, Any], b: dict[str, Any]) -> tuple[float, dict[str, Any]]:
    logic_score = percent(weighted_jaccard(a["logic_tokens"], b["logic_tokens"]))
    service_score = percent(weighted_jaccard(a["services"], b["services"]))
    endpoint_score = percent(weighted_jaccard(a["endpoints"], b["endpoints"]))
    utility_score = percent(weighted_jaccard(a["functions"], b["functions"]))
    submetrics = {
        "business_logic_token_overlap": (logic_score, 35),
        "third_party_service_config_overlap": (service_score, 25),
        "api_endpoint_integration_overlap": (endpoint_score, 20),
        "utility_function_overlap": (utility_score, 20),
    }
    score = weighted_average(submetrics)
    evidence = {
        "matched_services": top_common(a["services"].keys(), b["services"].keys(), 30),
        "matched_endpoints": top_common(a["endpoints"].keys(), b["endpoints"].keys(), 30),
        "matched_function_names": top_common(a["functions"].keys(), b["functions"].keys(), 40),
        "top_shared_logic_tokens": [token for token, _ in (a["logic_tokens"] & b["logic_tokens"]).most_common(40)],
    }
    return score, {"overlap": score, "submetrics": {key: value[0] for key, value in submetrics.items()}, "evidence": evidence}


# --------------------------------------------------------------------------- #
# Independence scoring layer
# --------------------------------------------------------------------------- #

def submetric_points(dim_weight: float, share: float, total_share: float) -> float:
    """Max independence points a submetric can contribute (= its weight share)."""
    return dim_weight * (share / total_share) if total_share else 0.0


def dimension_independence(dim_overlap: float, dim_weight: float) -> float:
    return round(dim_weight * (1 - dim_overlap / 100.0), 2)


def classify_independence(score: float, config: dict[str, Any]) -> tuple[str, str, str]:
    """Return (tier_key, label_zh, emoji)."""
    tiers = config["tiers"]
    if score >= tiers["independent_min"]:
        return "independent", "完全独立项目", "✅"
    if score >= tiers["partial_min"]:
        return "partial", "存在部分复用痕迹", "⚠️"
    return "reskin", "高度疑似换皮", "❌"


def analyze_identity(identity_a: dict[str, str], identity_b: dict[str, str], config: dict[str, Any]) -> dict[str, Any]:
    """Detect same-origin identity signals and decide whether to override the total."""
    overrides = config["identity_override"]
    origin_a = identity_a.get("git_origin", "")
    origin_b = identity_b.get("git_origin", "")
    name_a = identity_a.get("package_name", "")
    name_b = identity_b.get("package_name", "")
    ver_a = identity_a.get("package_version", "")
    ver_b = identity_b.get("package_version", "")

    origin_match = bool(origin_a) and origin_a == origin_b
    name_match = bool(name_a) and name_a == name_b
    major_match = bool(ver_a) and bool(ver_b) and major_version(ver_a) == major_version(ver_b)

    reasons = []
    override = False
    if origin_match and overrides.get("same_git_origin"):
        reasons.append(f"git origin 相同：`{origin_a}`")
        override = True
    if name_match and major_match and overrides.get("same_package_name_and_major"):
        reasons.append(f"package name + 主版本相同：`{name_a}@{major_version(ver_a)}`")
        override = True
    return {
        "origin_match": origin_match,
        "name_match": name_match,
        "major_match": major_match,
        "override": override,
        "reasons": reasons,
    }


def high_risk_signals(dimensions: dict[str, dict[str, Any]], config: dict[str, Any]) -> list[dict[str, str]]:
    signals = []
    thresholds = config["high_risk_overlap_signals"]
    skel = dimensions["skeleton"]["overlap"]
    hier = dimensions["layout"]["submetrics"]["component_hierarchy_overlap"]
    logic_tok = dimensions["logic"]["submetrics"]["business_logic_token_overlap"]
    if skel > thresholds["skeleton_core"]:
        signals.append({"dimension": "skeleton", "text": f"技术骨架重叠 {skel:.1f}% > {thresholds['skeleton_core']}%，目录/依赖/构建几乎完全复用。"})
    if hier > thresholds["layout_structure"]:
        signals.append({"dimension": "layout", "text": f"页面组件层级重叠 {hier:.1f}% > {thresholds['layout_structure']}%，页面组装方式未重建。"})
    if logic_tok > 60 and skel > 60:
        signals.append({"dimension": "logic", "text": f"业务逻辑 token 重叠 {logic_tok:.1f}% 且骨架 {skel:.1f}%，功能性同源。"})
    return signals


def build_recommendations(dimensions: dict[str, dict[str, Any]], config: dict[str, Any]) -> list[dict[str, Any]]:
    """Per-submetric advice ranked by recoverable independence points."""
    rem = config["remediation"]
    target = rem["target_overlap"]
    trigger = rem["submetric_trigger"]
    p_thresholds = rem["priority_thresholds"]

    rows: list[dict[str, Any]] = []
    for dim_key, meta in DIMENSION_META.items():
        dim_weight = config["weights"][dim_key]
        submeta = meta["submetrics"]
        total_share = sum(item[2] for item in submeta)
        sub_overlaps = {s["key"]: s["overlap_pct"] for s in dimensions[dim_key]["submetrics"]}
        for key, label_zh, share, kind in submeta:
            overlap_pct = sub_overlaps.get(key, 0.0)
            overlap = overlap_pct / 100.0
            if overlap <= trigger:
                continue
            points = submetric_points(dim_weight, share, total_share)
            deducted = round(points * overlap, 2)
            recoverable = round(points * max(0.0, overlap - target), 2)
            priority = _priority_for(recoverable, p_thresholds)
            rows.append({
                "priority": priority,
                "dimension": dim_key,
                "dimension_label": DIMENSION_META[dim_key]["label_zh"],
                "submetric": key,
                "submetric_label": label_zh,
                "overlap_pct": round(overlap_pct, 2),
                "points": round(points, 2),
                "deducted": deducted,
                "recoverable": recoverable,
                "action": ACTION_TEMPLATES.get(kind, "针对性重构该子指标涉及的实现，降低重叠。"),
            })
    rows.sort(key=lambda r: r["recoverable"], reverse=True)
    return rows


def _priority_for(recoverable: float, thresholds: list[float]) -> str:
    for index, cutoff in enumerate(thresholds):
        if recoverable >= cutoff:
            return f"P{index}"
    return f"P{len(thresholds)}"


def iteration_path(score: float, recommendations: list[dict[str, Any]], config: dict[str, Any]) -> dict[str, Any]:
    target_score = config["tiers"]["independent_min"]
    gap = round(max(0.0, target_score - score), 2)
    max_recoverable = round(sum(r["recoverable"] for r in recommendations), 2)
    top = recommendations[:5]
    top_recoverable = round(sum(r["recoverable"] for r in top), 2)
    feasible = max_recoverable >= gap
    return {
        "target_score": target_score,
        "current_score": score,
        "gap": gap,
        "max_recoverable": max_recoverable,
        "feasible": feasible,
        "top_actions": top,
        "top_recoverable": top_recoverable,
    }


# --------------------------------------------------------------------------- #
# Report assembly
# --------------------------------------------------------------------------- #

def build_dimension_detail(dim_key: str, overlap: float, detail: dict[str, Any], config: dict[str, Any]) -> dict[str, Any]:
    meta = DIMENSION_META[dim_key]
    dim_weight = config["weights"][dim_key]
    submeta = meta["submetrics"]
    total_share = sum(item[2] for item in submeta)
    sub_rows = []
    for key, label_zh, share, _kind in submeta:
        overlap_pct = detail["submetrics"].get(key, 0.0)
        points = submetric_points(dim_weight, share, total_share)
        sub_rows.append({
            "key": key,
            "label_zh": label_zh,
            "share": share,
            "overlap_pct": round(overlap_pct, 2),
            "points": round(points, 2),
            "deducted": round(points * overlap_pct / 100.0, 2),
        })
    return {
        "key": dim_key,
        "label_zh": meta["label_zh"],
        "label_en": meta["label_en"],
        "weight": dim_weight,
        "overlap": round(overlap, 2),
        "independence": dimension_independence(overlap, dim_weight),
        "deducted": round(dim_weight - dimension_independence(overlap, dim_weight), 2),
        "submetrics": sub_rows,
        "evidence": detail["evidence"],
    }


def build_report(project_a: Path, project_b: Path, config: dict[str, Any], source_label: str, target_label: str) -> dict[str, Any]:
    analyzed_a = analyze_project(project_a, config)
    analyzed_b = analyze_project(project_b, config)

    skel_overlap, skel_detail = dimension_skeleton(analyzed_a, analyzed_b, config)
    layout_overlap, layout_detail = dimension_layout(analyzed_a, analyzed_b)
    visual_overlap, visual_detail = dimension_visual(analyzed_a, analyzed_b)
    logic_overlap, logic_detail = dimension_logic(analyzed_a, analyzed_b)

    raw = {
        "skeleton": (skel_overlap, skel_detail),
        "layout": (layout_overlap, layout_detail),
        "visual": (visual_overlap, visual_detail),
        "logic": (logic_overlap, logic_detail),
    }
    dimensions = {key: build_dimension_detail(key, overlap, detail, config) for key, (overlap, detail) in raw.items()}

    raw_score = round(sum(dimensions[key]["independence"] for key in dimensions), 2)

    identity = analyze_identity(analyzed_a["identity"], analyzed_b["identity"], config)
    cap = config["tiers"]["identity_cap"] if identity["override"] else None
    score = min(raw_score, cap) if cap is not None else raw_score
    capped = cap is not None and raw_score > cap

    tier_key, tier_label, tier_emoji = classify_independence(score, config)
    signals = high_risk_signals({k: {"overlap": v["overlap"], "submetrics": {s["key"]: s["overlap_pct"] for s in v["submetrics"]}} for k, v in dimensions.items()}, config)
    recommendations = build_recommendations({k: v for k, v in dimensions.items()}, config)
    path_info = iteration_path(score, recommendations, config)

    return {
        "generated_at": datetime.date.today().isoformat(),
        "model_version": "independence-2.0",
        "projects": {
            "source": {
                "label": source_label,
                "root": str(project_a),
                "file_count": analyzed_a["file_count"],
                "total_bytes": analyzed_a["total_bytes"],
                "identity": analyzed_a["identity"],
            },
            "target": {
                "label": target_label,
                "root": str(project_b),
                "file_count": analyzed_b["file_count"],
                "total_bytes": analyzed_b["total_bytes"],
                "identity": analyzed_b["identity"],
            },
        },
        "score": score,
        "raw_score": raw_score,
        "score_capped_by_identity": capped,
        "tier": tier_key,
        "tier_label_zh": tier_label,
        "tier_emoji": tier_emoji,
        "safety_line": config["tiers"]["independent_min"],
        "weights": config["weights"],
        "tiers": config["tiers"],
        "identity": identity,
        "high_risk_signals": signals,
        "dimensions": dimensions,
        "recommendations": recommendations,
        "iteration_path": path_info,
        "inventory": {
            "source": {"frameworks": sorted(analyzed_a["frameworks"]), "state": sorted(analyzed_a["state"])},
            "target": {"frameworks": sorted(analyzed_b["frameworks"]), "state": sorted(analyzed_b["state"])},
        },
    }


# --------------------------------------------------------------------------- #
# Rendering
# --------------------------------------------------------------------------- #

def to_jsonable(value: Any) -> Any:
    if isinstance(value, Counter):
        return dict(value)
    if isinstance(value, set):
        return sorted(value)
    if isinstance(value, FileRecord):
        return {"rel": value.rel, "size": value.size, "sha1": value.sha1, "normalized_sha1": value.normalized_sha1}
    if isinstance(value, dict):
        return {key: to_jsonable(item) for key, item in value.items() if key != "records"}
    if isinstance(value, list):
        return [to_jsonable(item) for item in value]
    return value


def _fmt_pct(x: float) -> str:
    return f"{x:.1f}%"


def render_markdown_zh(report: dict[str, Any]) -> str:
    src = report["projects"]["source"]
    tgt = report["projects"]["target"]
    dims = report["dimensions"]
    identity = report["identity"]
    safety = report["safety_line"]
    score = report["score"]
    gap = report["iteration_path"]["gap"]

    out: list[str] = []
    out.append("# 前端同源换皮检测报告")
    out.append("")
    out.append(f"> 生成日期：{report['generated_at']}")
    out.append(f"> 评分模型：独立性得分 v2（满分 100，越高越独立）")
    out.append(f"> 工具：`.agents/skills/detecting-frontend-reskins`（`scripts/reskin_audit.py`）")
    out.append("> 对比对象：")
    out.append(f"> - **A = {src['label']}**（`{src['root']}`）")
    out.append(f"> - **B = {tgt['label']}**（`{tgt['root']}`）")
    out.append("")
    out.append("---")
    out.append("")

    # 一、结论
    out.append("## 一、结论")
    out.append("")
    out.append(f"- **独立性得分：{score} / 100**　{report['tier_emoji']} **{report['tier_label_zh']}**")
    if report["score_capped_by_identity"]:
        out.append(f"- ⚠️ 同源身份铁证命中，原始独立性 {report['raw_score']} 已被钳制至 ≤{report['tiers']['identity_cap']}。")
    out.append(f"- 竞标安全线（≥{safety}）：{'✅ 已达标' if score >= safety else f'❌ 未达标，差 {gap} 分'}")
    id_reason = "；".join(identity["reasons"]) if identity["reasons"] else "未命中"
    out.append(f"- 同源身份铁证：{id_reason}")
    out.append("")

    # 二、评分模型
    out.append("## 二、评分模型")
    out.append("")
    out.append("**总分 100 = 独立性得分**（越高越独立，100 = 完全独立，0 = 完全相同）。每维度独立分 = 满分 ×（1 − 重叠度）；检测到同源重叠即扣分。")
    out.append("")
    out.append("| 维度 | 满分 | 检测方向 |")
    out.append("| --- | ---: | --- |")
    out.append("| 技术骨架 | 25 | 目录结构、技术栈选型、工程配置、核心工具链复用 |")
    out.append("| 页面布局 | 30 | 路由结构、组件层级、页面元素排版逻辑 |")
    out.append("| 视觉体系 | 25 | 色彩系统、字体规范、图标库、通用组件样式 |")
    out.append("| 业务逻辑 | 20 | 核心业务流程、状态管理逻辑、接口调用逻辑 |")
    out.append("")
    out.append("| 独立性得分 | 等级 | 含义 |")
    out.append("| ---: | --- | --- |")
    out.append(f"| **≥{report['tiers']['independent_min']}** | ✅ 完全独立项目 | **竞标安全区（迭代目标）**，常规代码审计也判为独立 |")
    out.append(f"| {report['tiers']['partial_min']}–{report['tiers']['independent_min'] - 1} | ⚠️ 存在部分复用痕迹 | 有同源线索，需继续迭代高危维度 |")
    out.append(f"| **≤{report['tiers']['identity_cap']}** | ❌ 高度疑似换皮 | 同源可识别，**禁止竞标** |")
    out.append("")
    out.append(f"> **身份 override**：git origin 相同，或 package name + 主版本相同 → 总分钳制 ≤{report['tiers']['identity_cap']}（竞标方一眼可见，无法用代码改造解释）。")
    out.append("")

    # 三、维度得分
    out.append("## 三、维度得分")
    out.append("")
    out.append("| 维度 | 满分 | 重叠度 | 独立分 | 扣分 |")
    out.append("| --- | ---: | ---: | ---: | ---: |")
    for key in ("skeleton", "layout", "visual", "logic"):
        d = dims[key]
        out.append(f"| {d['label_zh']} | {d['weight']} | {_fmt_pct(d['overlap'])} | {d['independence']} | {d['deducted']} |")
    out.append(f"| **合计** | **100** | — | **{score}** | **{round(100 - score, 2)}** |")
    out.append("")

    # 四、子指标扣分明细
    out.append("## 四、子指标扣分明细")
    out.append("")
    evidence_renderers = {
        "skeleton": _evidence_skeleton,
        "layout": _evidence_layout,
        "visual": _evidence_visual,
        "logic": _evidence_logic,
    }
    for key in ("skeleton", "layout", "visual", "logic"):
        d = dims[key]
        out.append(f"### {d['label_zh']}（满分 {d['weight']}，独立分 {d['independence']}，扣分 {d['deducted']}）")
        out.append("")
        out.append("| 子指标 | 份额 | 重叠度 | 子指标总分 | 扣分 |")
        out.append("| --- | ---: | ---: | ---: | ---: |")
        for s in d["submetrics"]:
            out.append(f"| {s['label_zh']} | {s['share']} | {_fmt_pct(s['overlap_pct'])} | {s['points']} | {s['deducted']} |")
        out.append("")
        ev_lines = evidence_renderers[key](d["evidence"])
        if ev_lines:
            out.append("**关键证据：**")
            out.append("")
            out.extend(ev_lines)
            out.append("")

    # 五、同源身份信号
    out.append("## 五、同源身份信号")
    out.append("")
    out.append("| 项 | A | B | 命中 |")
    out.append("| --- | --- | --- | --- |")
    sa, sb = src["identity"], tgt["identity"]
    out.append(f"| git origin | `{sa.get('git_origin', '')}` | `{sb.get('git_origin', '')}` | {'✅' if identity['origin_match'] else '—'} |")
    out.append(f"| package name | `{sa.get('package_name', '')}` | `{sb.get('package_name', '')}` | {'✅' if identity['name_match'] else '—'} |")
    out.append(f"| package version | `{sa.get('package_version', '')}` | `{sb.get('package_version', '')}` | {'主版本同' if identity['major_match'] else '—'} |")
    out.append("")
    if identity["override"]:
        out.append(f"**身份 override 生效**：{'；'.join(identity['reasons'])} → 总分钳制 ≤{report['tiers']['identity_cap']}。这是竞标场景下最致命的识别信号，必须首先改造（改包名 / 切换 git 远端 / 拆分仓库）。")
    else:
        out.append("身份 override 未生效：未发现 git origin 或包身份强同源。")
    out.append("")

    # 六、高危信号
    out.append("## 六、高危信号")
    out.append("")
    if report["high_risk_signals"]:
        for sig in report["high_risk_signals"]:
            out.append(f"- ⚠️ {sig['text']}")
    else:
        out.append("- 无单维度高危信号触发。")
    out.append("")

    # 七、优化建议清单
    out.append("## 七、优化建议清单（按可回收分降序）")
    out.append("")
    out.append("> 「可回收分」= 把该子指标重叠压到 15%（独立档残留）后能恢复的独立性分数。优先做回收分高的项，性价比最高。")
    out.append("")
    if report["recommendations"]:
        out.append("| 优先级 | 维度 | 子指标 | 当前重叠 | 已扣分 | 预期回收 | 动作 |")
        out.append("| --- | --- | --- | ---: | ---: | ---: | --- |")
        for r in report["recommendations"]:
            out.append(f"| {r['priority']} | {r['dimension_label']} | {r['submetric_label']} | {_fmt_pct(r['overlap_pct'])} | {r['deducted']} | **+{r['recoverable']}** | {r['action']} |")
    else:
        out.append("无子指标超过 30% 重叠阈值，当前已处于低同源状态。")
    out.append("")

    # 八、迭代路径
    out.append("## 八、迭代路径（目标 ≥{})".format(safety))
    out.append("")
    ip = report["iteration_path"]
    out.append(f"- 当前独立性：**{ip['current_score']} / 100**，距安全线 ≥{safety} 还差 **{ip['gap']} 分**。")
    out.append(f"- 最大可回收：**{ip['max_recoverable']} 分**（将所有 >15% 的子指标重叠压至 15%）。")
    if ip["feasible"]:
        out.append(f"- 可行性：✅ 最大可回收 ≥ 差值，达到安全线**可行**。")
    else:
        out.append(f"- 可行性：⚠️ 最大可回收 < 差值，仅靠代码层改造**不足以**达标，须先消除身份 override（改包名 / 切 git 远端 / 拆仓库）。")
    out.append("")
    if ip["top_actions"]:
        out.append(f"**推荐先做 Top {len(ip['top_actions'])} 改动**（累计可回收 **{ip['top_recoverable']} 分**）：")
        out.append("")
        for idx, r in enumerate(ip["top_actions"], 1):
            out.append(f"{idx}. [{r['priority']}] {r['dimension_label']} / {r['submetric_label']}（当前 {_fmt_pct(r['overlap_pct'])}，可回收 +{r['recoverable']}）—— {r['action']}")
        out.append("")

    # 九、方法说明
    out.append("## 九、方法说明与局限")
    out.append("")
    out.append("- 评分基于源码树**静态分析**（依赖、目录、路由、JSX 标签序列、CSS 值/token、函数名/端点字符串等），**不含运行时行为对比**。")
    out.append("- 已自动忽略 `node_modules` / `dist` / `build` / `.git` 等生成物；lockfile 噪声未计入依赖身份判断。")
    out.append("- 同框架（CRA / Vite / Next / antd 等）会产生一部分「合理重叠」，但身份 override 与多维高分交叉验证可区分真同源与框架巧合。")
    out.append("- 独立性得分是**同源可识别度的工程指示器**，迭代目标是 ≥{0}（完全独立项目 / 竞标安全区）。".format(safety))
    out.append("")
    out.append("---")
    out.append("")
    out.append("## 附录：原始产物与复跑命令")
    out.append("")
    out.append("```bash")
    out.append("python3 .agents/skills/detecting-frontend-reskins/scripts/reskin_audit.py \\")
    out.append(f"  {src['root']} {tgt['root']} \\")
    out.append("  --output /tmp/reskin-audit --format both --lang zh")
    out.append("```")
    return "\n".join(out)


def _clean_route(token: str) -> bool:
    # display filter: keep only clean REST-ish paths, drop template-literal/code noise
    return bool(token.startswith("/") and re.fullmatch(r"/[A-Za-z0-9_:/{}.-]{1,60}", token))


def _clean_var(token: str) -> bool:
    # display filter: real CSS custom property is "--" immediately followed by a letter.
    # Rejects "-----mac" / "---webkitformboundary..." noise from bundled/minified CSS.
    return bool(re.fullmatch(r"--[A-Za-z][A-Za-z0-9_-]*", token))


def _clean_ident(token: str) -> bool:
    # display filter: function/identifier names must be >=2 chars and contain a letter
    return len(token) >= 2 and bool(re.search(r"[A-Za-z]", token))


def _clean_spacing(token: str) -> bool:
    # display filter: drop JS-expression leaks caught by the spacing regex
    return not any(bad in token for bad in ("?", "undefined", ";", "&&", "||", "=>"))


def _evidence_skeleton(ev: dict[str, Any]) -> list[str]:
    lines: list[str] = []
    deps = [f"`{d['name']}`({d['project_a']}↔{d['project_b']})" for d in ev.get("matched_dependencies", [])[:12]]
    if deps:
        lines.append(f"- 同版本依赖（{len(ev.get('matched_dependencies', []))} 项，抽样）：{', '.join(deps)}")
    if ev.get("matched_frameworks"):
        lines.append(f"- 共同框架：{', '.join(f'`{x}`' for x in ev['matched_frameworks'])}")
    if ev.get("matched_state_libraries"):
        lines.append(f"- 共同状态库：{', '.join(f'`{x}`' for x in ev['matched_state_libraries'])}")
    if ev.get("matched_directories"):
        lines.append(f"- 共同目录签名（抽样）：{', '.join(f'`{x}`' for x in ev['matched_directories'][:15])}")
    routes = [r for r in ev.get("matched_routes", []) if _clean_route(r)]
    if routes:
        lines.append(f"- 共同路由（抽样）：{', '.join(f'`{x}`' for x in routes[:15])}")
    return lines


def _evidence_layout(ev: dict[str, Any]) -> list[str]:
    lines: list[str] = []
    hier = ev.get("hierarchy_matches", [])[:6]
    if hier:
        lines.append("- 组件层级最佳匹配（抽样）：")
        for h in hier:
            lines.append(f"  - `{h['project_a']}` ↔ `{h['project_b']}`（重叠 {_fmt_pct(h['overlap'])}）")
    if ev.get("matched_section_or_class_names"):
        lines.append(f"- 共同 class/分区名（抽样）：{', '.join(f'`{x}`' for x in ev['matched_section_or_class_names'][:15])}")
    comps = ev.get("matching_component_fingerprints", [])[:8]
    if comps:
        lines.append("- 共享组件实现指纹碰撞（实现几乎相同）：")
        for c in comps:
            lines.append(f"  - `{c['project_a']}` ↔ `{c['project_b']}`（fp `{c['fingerprint']}`）")
    if ev.get("matched_breakpoint_patterns"):
        lines.append(f"- 共同断点/响应式模式：{', '.join(f'`{x}`' for x in ev['matched_breakpoint_patterns'][:10])}")
    return lines


def _evidence_visual(ev: dict[str, Any]) -> list[str]:
    lines: list[str] = []
    if ev.get("matched_colors"):
        lines.append(f"- 共同颜色值（抽样）：{', '.join(f'`{x}`' for x in ev['matched_colors'][:15])}")
    css_vars = [v for v in ev.get("matched_css_variables", []) if _clean_var(v)]
    if css_vars:
        lines.append(f"- 共同 CSS 变量/token 名（抽样）：{', '.join(f'`{x}`' for x in css_vars[:15])}")
    if ev.get("matched_typography_rules"):
        lines.append(f"- 共同字体规则：{', '.join(f'`{x}`' for x in ev['matched_typography_rules'][:10])}")
    spacing = [s for s in ev.get("matched_spacing_rules", []) if _clean_spacing(s)]
    if spacing:
        lines.append(f"- 共同间距规则：{', '.join(f'`{x}`' for x in spacing[:10])}")
    if ev.get("matched_motion_rules"):
        lines.append(f"- 共同动效规则：{', '.join(f'`{x}`' for x in ev['matched_motion_rules'][:10])}")
    return lines


def _evidence_logic(ev: dict[str, Any]) -> list[str]:
    lines: list[str] = []
    if ev.get("matched_services"):
        lines.append(f"- 共同第三方服务：{', '.join(f'`{x}`' for x in ev['matched_services'])}")
    endpoints = [e for e in ev.get("matched_endpoints", []) if _clean_route(e) or e.startswith(("http://", "https://"))]
    if endpoints:
        lines.append(f"- 共同 API 端点（抽样）：{', '.join(f'`{x}`' for x in endpoints[:15])}")
    funcs = [f for f in ev.get("matched_function_names", []) if _clean_ident(f)]
    if funcs:
        lines.append(f"- 共同函数名（抽样）：{', '.join(f'`{x}`' for x in funcs[:15])}")
    toks = ev.get("top_shared_logic_tokens", [])[:20]
    if toks:
        lines.append(f"- 高频共享逻辑 token：{', '.join(f'`{x}`' for x in toks)}")
    return lines


def render_markdown(report: dict[str, Any], lang: str = "zh") -> str:
    if lang == "en":
        # English render kept lightweight; Chinese is the primary deliverable.
        return _render_markdown_en(report)
    return render_markdown_zh(report)


def _render_markdown_en(report: dict[str, Any]) -> str:
    src = report["projects"]["source"]
    tgt = report["projects"]["target"]
    dims = report["dimensions"]
    score = report["score"]
    safety_status = "PASS" if score >= 70 else f"FAIL (need +{report['iteration_path']['gap']})"
    out = [
        "# Frontend Reskin Independence Audit",
        "",
        f"> Generated: {report['generated_at']} | Model: independence v2 (0-100, higher = more independent)",
        f"> Source: `{src['root']}` | Target: `{tgt['root']}`",
        "",
        "## Summary",
        "",
        f"- Independence score: **{score}/100** {report['tier_emoji']} {report['tier_label_zh']}",
        f"- Bid-safe line (>=70): {safety_status}",
        "",
        "## Dimensions",
        "",
        "| Dimension | Weight | Overlap | Independence | Deducted |",
        "| --- | ---: | ---: | ---: | ---: |",
    ]
    for key in ("skeleton", "layout", "visual", "logic"):
        d = dims[key]
        out.append(f"| {d['label_en']} | {d['weight']} | {_fmt_pct(d['overlap'])} | {d['independence']} | {d['deducted']} |")
    out.append(f"| **Total** | **100** | — | **{score}** | **{round(100 - score, 2)}** |")
    out.append("")
    out.append("## Recommendations (by recoverable points)")
    out.append("")
    if report["recommendations"]:
        out.append("| Priority | Dimension | Submetric | Overlap | Recoverable | Action |")
        out.append("| --- | --- | --- | ---: | ---: | --- |")
        for r in report["recommendations"]:
            out.append(f"| {r['priority']} | {DIMENSION_META[r['dimension']]['label_en']} | {r['submetric']} | {_fmt_pct(r['overlap_pct'])} | +{r['recoverable']} | {r['action']} |")
    out.append("")
    return "\n".join(out)


# --------------------------------------------------------------------------- #
# Config merge + CLI
# --------------------------------------------------------------------------- #

def merge_config(path: Path | None) -> dict[str, Any]:
    config = json.loads(json.dumps(DEFAULT_CONFIG))
    if not path:
        return config
    override = json.loads(path.read_text(encoding="utf-8"))
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(config.get(key), dict):
            config[key].update(value)
        else:
            config[key] = value
    weights = config["weights"]
    if not math.isclose(sum(weights.values()), 100, abs_tol=0.001):
        raise ValueError(f"weights must sum to 100, got {sum(weights.values())}")
    if set(weights) != {"skeleton", "layout", "visual", "logic"}:
        raise ValueError(f"weights keys must be skeleton/layout/visual/logic, got {sorted(weights)}")
    return config


def write_outputs(report: dict[str, Any], output: Path, output_format: str, lang: str) -> list[Path]:
    output.mkdir(parents=True, exist_ok=True)
    written = []
    if output_format in {"json", "both"}:
        json_path = output / "reskin-audit-report.json"
        json_path.write_text(json.dumps(to_jsonable(report), ensure_ascii=False, indent=2), encoding="utf-8")
        written.append(json_path)
    if output_format in {"markdown", "both"}:
        md_path = output / "reskin-audit-report.md"
        md_path.write_text(render_markdown(report, lang), encoding="utf-8")
        written.append(md_path)
    return written


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Detect whether two frontend projects are a trivial reskin (independence score, higher = safer).")
    parser.add_argument("project_a", type=Path, help="first frontend project root (source)")
    parser.add_argument("project_b", type=Path, help="second frontend project root (target)")
    parser.add_argument("--output", type=Path, default=Path("reskin-audit-output"))
    parser.add_argument("--format", choices=["json", "markdown", "both"], default="both")
    parser.add_argument("--config", type=Path)
    parser.add_argument("--source-label", default="source")
    parser.add_argument("--target-label", default="target")
    parser.add_argument("--lang", choices=["zh", "en"], default="zh")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    project_a = args.project_a.resolve()
    project_b = args.project_b.resolve()
    if not project_a.is_dir():
        raise SystemExit(f"project_a is not a directory: {project_a}")
    if not project_b.is_dir():
        raise SystemExit(f"project_b is not a directory: {project_b}")
    config = merge_config(args.config)
    report = build_report(project_a, project_b, config, args.source_label, args.target_label)
    written = write_outputs(report, args.output.resolve(), args.format, args.lang)
    print(f"独立性得分: {report['score']}/100  {report['tier_emoji']} {report['tier_label_zh']}")
    if report["score_capped_by_identity"]:
        print(f"  (身份 override 生效，原始 {report['raw_score']} 钳制至 ≤{report['tiers']['identity_cap']})")
    print(f"  距安全线(≥{report['safety_line']}): 差 {report['iteration_path']['gap']} 分 | 最大可回收 {report['iteration_path']['max_recoverable']} 分")
    for path in written:
        print(path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
