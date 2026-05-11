# 参考代码（零脚本落地优先，SQL-first）

本参考优先采用“**不生成中间 .py 文件**”的执行方式：

- SQL 直接查询 `analysis.db`
- 结果直接组织为 Markdown 文本
- 直接写入目标报告文件（逐户 + 汇总）

只有在 SQL 无法表达的复杂逻辑下，才允许最小 Python 辅助。

---

## 一、执行原则（强制）

1. 不默认生成 `scripts/analyze_tax.py`、`scripts/gen_reports.py`、`scripts/import_tax_data.py`
2. 查询逻辑优先 SQL
3. Markdown 报告直接写入 `.md`
4. 仅当用户明确要求“沉淀脚本”时才创建 `.py`

---

## 二、标准视图准备（一次）

> 先调用 `/xlsx-to-sqlite` 把 xlsx 导入 `output/tax-fraud-analysis-0327/analysis.db`。

视图准备目标：统一得到
- `seller_invoice`
- `buyer_invoice`
- `tax_registration`
- `business_registration`
- `bank_transaction`（可缺）

可按以下 SQL 自查：

```sql
SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;
PRAGMA table_info("候选表名");
```

映射后建议落盘 `table-mapping.json`（可选）。

---

## 中文列名参数绑定与编码（OpenCode）

### 1) 参数绑定规则（必须）

- `?` / `:name` 仅用于绑定“值”
- 不可用于表名、列名、排序字段

```sql
-- ✅ 正确
SELECT * FROM "seller_invoice" WHERE "销方识别号" = :tpid;

-- ❌ 错误
-- SELECT * FROM :table;
-- SELECT :col FROM "seller_invoice";
```

### 2) 动态标识符处理

动态表名/列名必须：
1. 白名单校验
2. 双引号转义
3. 再拼接 SQL

### 3) 中文路径/文件名编码建议

- 路径统一使用 `pathlib.Path`
- Python 运行环境优先 UTF-8（如设置 `PYTHONUTF8=1`）
- 日志乱码优先检查终端编码，不直接判定数据错误

---

## 三、逐户对象识别 SQL

```sql
WITH ids AS (
    SELECT NULLIF(TRIM(纳税人识别号), '') AS tpid,
           NULLIF(TRIM(纳税人名称), '') AS tpname
    FROM tax_registration
    UNION
    SELECT NULLIF(TRIM(销方识别号), ''), NULLIF(TRIM(销方名称), '')
    FROM seller_invoice
    UNION
    SELECT NULLIF(TRIM(购方识别号), ''), NULLIF(TRIM(购方名称), '')
    FROM buyer_invoice
), normalized AS (
    SELECT COALESCE(tpid, tpname) AS tpkey,
           COALESCE(tpid, '') AS tpid,
           COALESCE(tpname, '') AS tpname
    FROM ids
    WHERE COALESCE(tpid, tpname) IS NOT NULL
)
SELECT tpkey, MAX(tpid) AS tpid, MAX(tpname) AS tpname
FROM normalized
GROUP BY tpkey
ORDER BY tpkey;
```

---

## 四、核心风险 SQL（示例）

### 1) 销项概况（按单个纳税人）

```sql
SELECT
    COUNT(*) AS 明细行数,
    COUNT(DISTINCT 发票代码 || 发票号码) AS 发票张数,
    ROUND(SUM(CASE WHEN 货物金额 != '' THEN CAST(货物金额 AS REAL) ELSE 0 END), 2) AS 货物金额,
    ROUND(SUM(CASE WHEN 货物税额 != '' THEN CAST(货物税额 AS REAL) ELSE 0 END), 2) AS 税额,
    ROUND(SUM(CASE WHEN 价税合计 != '' THEN CAST(价税合计 AS REAL) ELSE 0 END), 2) AS 价税合计
FROM seller_invoice
WHERE 销方识别号 = :tpid OR (:tpid = '' AND 销方名称 = :tpname);
```

### 2) R02/R04/R05/R07/R08 量化

```sql
WITH s AS (
    SELECT *
    FROM seller_invoice
    WHERE 销方识别号 = :tpid OR (:tpid = '' AND 销方名称 = :tpname)
),
base AS (
    SELECT
        COUNT(*) AS total_cnt,
        SUM(CASE WHEN 价税合计 != '' THEN 1 ELSE 0 END) AS amt_cnt,
        SUM(CASE WHEN 价税合计 != '' AND CAST(价税合计 AS REAL) % 10000 = 0 THEN 1 ELSE 0 END) AS whole_cnt,
        SUM(CASE WHEN 作废标志 LIKE '%是%' OR 作废标志 LIKE '%Y%' OR 作废标志 = '1' OR 作废标志 LIKE '%作废%' THEN 1 ELSE 0 END) AS cancel_cnt,
        SUM(CASE WHEN 异地发票标志 != '' AND 异地发票标志 NOT IN ('0','否','N') THEN 1 ELSE 0 END) AS remote_cnt
    FROM s
)
SELECT
    ROUND(CASE WHEN amt_cnt=0 THEN 0 ELSE whole_cnt*100.0/amt_cnt END, 2) AS R02_整额开票占比,
    ROUND(CASE WHEN total_cnt=0 THEN 0 ELSE cancel_cnt*100.0/total_cnt END, 2) AS R05_作废率,
    ROUND(CASE WHEN total_cnt=0 THEN 0 ELSE remote_cnt*100.0/total_cnt END, 2) AS R08_异地发票占比
FROM base;
```

### 3) 够罪条件（专票/普票）

```sql
WITH s AS (
    SELECT *
    FROM seller_invoice
    WHERE 销方识别号 = :tpid OR (:tpid = '' AND 销方名称 = :tpname)
),
vat AS (
    SELECT ROUND(SUM(CASE WHEN 货物税额 != '' THEN CAST(货物税额 AS REAL) ELSE 0 END),2) AS 专票税额
    FROM s
    WHERE 发票类型 LIKE '%专用%' OR 发票类型 LIKE '%专票%' OR 发票类型 = ''
),
normal AS (
    SELECT ROUND(SUM(CASE WHEN 价税合计 != '' THEN CAST(价税合计 AS REAL) ELSE 0 END),2) AS 普票金额
    FROM s
    WHERE 发票类型 LIKE '%普通%' OR 发票类型 LIKE '%普票%'
)
SELECT
    vat.专票税额,
    CASE WHEN vat.专票税额 >= 5000000 THEN '专票第三档（>=500万）'
         WHEN vat.专票税额 >= 500000 THEN '专票第二档（>=50万）'
         WHEN vat.专票税额 >= 50000 THEN '专票第一档（>=5万）'
         ELSE '专票未达入罪参考阈值' END AS 专票档次,
    normal.普票金额,
    CASE WHEN normal.普票金额 >= 5000000 THEN '普票情节特别严重（>=500万）'
         WHEN normal.普票金额 >= 500000 THEN '普票情节严重（>=50万）'
         ELSE '普票一般或未达高风险阈值' END AS 普票档次
FROM vat, normal;
```

---

## 五、Markdown 报告直接落盘

- 逐户报告：`output/tax-fraud-analysis-0327/reports/taxpayer-*.md`
- 汇总报告：`output/tax-fraud-analysis-0327/summary-report.md`

要求：直接写入上述 `.md` 文件，不需要先生成 `gen_reports.py`。

---

## 六、何时才用 Python

仅以下场景允许最小 Python：
- 票流闭环深度搜索（DFS/BFS）
- 文本相似度/Jaccard
- 一次性拼接 Markdown 文本并写文件

即便使用 Python，也应优先“一次性执行”，避免在仓库生成长期脚本文件。
