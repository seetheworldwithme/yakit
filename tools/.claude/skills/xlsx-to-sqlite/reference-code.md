# xlsx-to-sqlite 参考代码（可直接运行）

下面是一个通用、精简、可执行的 XLSX -> SQLite 脚本：
- 不做业务类型识别
- 不做字段映射
- 不依赖任何特定列名
- 按工作表原样入库
- 导入后做一致性校验（列名/列序/行数/单元格文本值）

## 使用方式

1. 安装依赖：

```bash
pip install openpyxl
```

2. 保存以下脚本为 `xlsx_to_sqlite.py`，执行：

```bash
python xlsx_to_sqlite.py --input ./data --db ./output.db
```

- `--input` 可以是单个 `.xlsx` 文件或目录
- `--db` 是 SQLite 输出路径

## 脚本

```python
from __future__ import annotations

import argparse
import hashlib
import re
import sqlite3
import sys
import unicodedata
from datetime import date, datetime, time
from pathlib import Path
from typing import Iterable, List, Tuple

from openpyxl import load_workbook


def configure_runtime_utf8() -> None:
    # OpenCode/Windows 终端下优先保证日志输出可读，避免中文乱码
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass


def quote_ident(name: str) -> str:
    return '"' + name.replace('"', '""') + '"'


def sanitize_name(name: str) -> str:
    text = unicodedata.normalize("NFKC", (name or "").strip())
    text = re.sub(r"\s+", "_", text)
    text = re.sub(r"[^0-9A-Za-z_\u4e00-\u9fff]", "_", text)
    text = re.sub(r"_+", "_", text).strip("_")
    if not text:
        text = "unnamed"
    if text[0].isdigit():
        text = f"t_{text}"
    return text


def make_unique_names(raw_names: List[object], empty_prefix: str) -> List[str]:
    result: List[str] = []
    seen: dict[str, int] = {}

    for idx, raw in enumerate(raw_names, start=1):
        base = sanitize_name("" if raw is None else str(raw))
        if base == "unnamed":
            base = f"{empty_prefix}{idx}"

        count = seen.get(base, 0) + 1
        seen[base] = count

        name = base if count == 1 else f"{base}_{count}"
        result.append(name)

    return result


def cell_to_text(value: object) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M:%S")
    if isinstance(value, date):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, time):
        return value.strftime("%H:%M:%S")
    return str(value)


def digest_rows(rows: Iterable[List[str]]) -> str:
    h = hashlib.sha256()
    for row in rows:
        # 使用不可见分隔符构造稳定串，避免普通字符冲突
        h.update("\x1f".join(row).encode("utf-8"))
        h.update(b"\x1e")
    return h.hexdigest()


def find_xlsx_files(input_path: Path) -> List[Path]:
    if input_path.is_file() and input_path.suffix.lower() == ".xlsx":
        return [input_path]
    if input_path.is_dir():
        return sorted(input_path.rglob("*.xlsx"))
    return []


def extract_sheet(sheet) -> Tuple[List[str], List[List[str]]]:
    row_iter = sheet.iter_rows(values_only=True)

    try:
        header = list(next(row_iter))
    except StopIteration:
        return [], []

    columns = make_unique_names(header, empty_prefix="col_")
    col_count = len(columns)

    rows: List[List[str]] = []
    for raw_row in row_iter:
        values = list(raw_row)
        if len(values) < col_count:
            values.extend([None] * (col_count - len(values)))
        elif len(values) > col_count:
            values = values[:col_count]

        rows.append([cell_to_text(v) for v in values])

    return columns, rows


def make_table_name(workbook_stem: str, sheet_title: str, used: set[str]) -> str:
    base = f"{sanitize_name(workbook_stem)}__{sanitize_name(sheet_title)}"
    if not base:
        base = "table"
    if base[0].isdigit():
        base = f"t_{base}"

    name = base
    idx = 2
    while name in used:
        name = f"{base}_{idx}"
        idx += 1
    used.add(name)
    return name


def create_table(conn: sqlite3.Connection, table: str, columns: List[str]) -> None:
    col_defs = ", ".join(f"{quote_ident(c)} TEXT" for c in columns)
    conn.execute(f"DROP TABLE IF EXISTS {quote_ident(table)}")
    conn.execute(f"CREATE TABLE {quote_ident(table)} ({col_defs})")


def insert_rows(conn: sqlite3.Connection, table: str, columns: List[str], rows: List[List[str]]) -> None:
    if not rows:
        return
    cols_sql = ", ".join(quote_ident(c) for c in columns)
    placeholders = ", ".join(["?"] * len(columns))
    conn.executemany(
        f"INSERT INTO {quote_ident(table)} ({cols_sql}) VALUES ({placeholders})",
        rows,
    )


def verify_consistency(
    conn: sqlite3.Connection,
    table: str,
    src_columns: List[str],
    src_rows: List[List[str]],
) -> Tuple[bool, str]:
    # 1) 列名与列顺序
    pragma_rows = conn.execute(f"PRAGMA table_info({quote_ident(table)})").fetchall()
    db_columns = [r[1] for r in pragma_rows]
    if db_columns != src_columns:
        return False, f"列不一致: src={src_columns}, db={db_columns}"

    # 2) 行数
    db_count = conn.execute(f"SELECT COUNT(*) FROM {quote_ident(table)}").fetchone()[0]
    if db_count != len(src_rows):
        return False, f"行数不一致: src={len(src_rows)}, db={db_count}"

    # 3) 单元格文本值（按插入顺序）
    if src_columns:
        col_select = ", ".join(quote_ident(c) for c in src_columns)
        db_rows_raw = conn.execute(
            f"SELECT {col_select} FROM {quote_ident(table)} ORDER BY rowid"
        ).fetchall()
    else:
        db_rows_raw = []

    db_rows = [[cell_to_text(v) for v in row] for row in db_rows_raw]

    src_hash = digest_rows(src_rows)
    db_hash = digest_rows(db_rows)
    if src_hash != db_hash:
        return False, f"内容哈希不一致: src={src_hash}, db={db_hash}"

    return True, "OK"


def import_xlsx_to_sqlite(input_path: Path, db_path: Path) -> int:
    files = find_xlsx_files(input_path)
    if not files:
        print("未找到 .xlsx 文件")
        return 1

    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.execute("PRAGMA encoding='UTF-8'")
    conn.execute("PRAGMA journal_mode=WAL")

    used_tables = set(
        row[0]
        for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    )

    failures = 0

    for file_path in files:
        print(f"\n处理文件: {file_path}")

        try:
            workbook = load_workbook(str(file_path), read_only=True, data_only=False)
        except Exception as exc:
            failures += 1
            print(f"  读取失败: {exc}")
            continue

        for sheet_name in workbook.sheetnames:
            sheet = workbook[sheet_name]
            columns, rows = extract_sheet(sheet)

            table_name = make_table_name(file_path.stem, sheet_name, used_tables)

            # 空工作表：创建空表（无列时跳过建表并提示）
            if not columns:
                failures += 1
                print(f"  工作表 [{sheet_name}] 为空，跳过")
                continue

            try:
                create_table(conn, table_name, columns)
                insert_rows(conn, table_name, columns, rows)
                conn.commit()

                ok, msg = verify_consistency(conn, table_name, columns, rows)
                if ok:
                    print(
                        f"  [{sheet_name}] -> [{table_name}] 行数={len(rows)} 列数={len(columns)} 校验=通过"
                    )
                else:
                    failures += 1
                    print(
                        f"  [{sheet_name}] -> [{table_name}] 行数={len(rows)} 列数={len(columns)} 校验=失败: {msg}"
                    )
            except Exception as exc:
                conn.rollback()
                failures += 1
                print(f"  [{sheet_name}] 导入失败: {exc}")

        workbook.close()

    conn.close()

    if failures:
        print(f"\n完成：存在失败项，共 {failures} 个")
        return 2

    print("\n完成：全部导入并通过一致性校验")
    return 0


def main() -> int:
    configure_runtime_utf8()
    parser = argparse.ArgumentParser(description="通用 XLSX -> SQLite 转换器（含一致性校验）")
    parser.add_argument("--input", required=True, help="输入 xlsx 文件或目录")
    parser.add_argument("--db", required=True, help="输出 sqlite 文件路径")
    args = parser.parse_args()

    return import_xlsx_to_sqlite(Path(args.input), Path(args.db))


if __name__ == "__main__":
    raise SystemExit(main())
```

## 说明
- 所有列按 `TEXT` 存储，避免自动类型转换导致的值变化
- 该脚本默认覆盖同名目标表（`DROP TABLE IF EXISTS` 后重建）
- 如果需要“追加模式”，可在 `create_table` 逻辑基础上自行扩展


## 中文列名参数绑定（必须）

SQLite 参数绑定仅适用于“值”，不适用于表名/列名：

```python
# ✅ 正确：绑定值
sql = 'SELECT * FROM "seller_invoice" WHERE "销方识别号" = :tpid'
rows = conn.execute(sql, {"tpid": taxpayer_id}).fetchall()

# ❌ 错误：绑定标识符（会报错）
# conn.execute('SELECT * FROM :table', {"table": "seller_invoice"})
# conn.execute('SELECT :col FROM "seller_invoice"', {"col": "销方识别号"})
```

动态表名/列名必须先做白名单校验，再用 `quote_ident()` 转义后拼接。
