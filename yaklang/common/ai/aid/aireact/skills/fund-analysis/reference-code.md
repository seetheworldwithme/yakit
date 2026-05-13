# 参考代码片段

按分析维度组织的 Python 代码片段。**不是可以直接运行的完整脚本**，而是供模型根据实际数据格式组合和调整的参考。

使用前请先确认：
1. 实际的列名（用 `df.columns.tolist()` 检查）
2. 收付标志的具体取值（用 `df['收付标志'].unique()` 检查）
3. 数据类型（用 `df.dtypes` 检查，金额是否为数值型、时间是否需要转换）

---

## 1. 数据读取与探查

```python
import pandas as pd
import numpy as np
from collections import defaultdict

# --- 识别并读取数据文件 ---
# 通过列名自动识别文件类型，也可手动指定文件路径
import glob

files = glob.glob('*.xlsx') + glob.glob('*.xls')
file_map = {}  # type -> filepath

for f in files:
    df_tmp = pd.read_excel(f, nrows=1)
    cols = set(df_tmp.columns.tolist())

    if '交易时间' in cols and '收付标志' in cols:
        file_map['交易明细'] = f
    elif '客户名称' in cols and '证照号码' in cols:
        file_map['人员信息'] = f
    elif '账户开户名称' in cols and '开户网点' in cols:
        file_map['账户信息'] = f
    elif '子账户账号' in cols and '子账户类别' in cols:
        file_map['子账户信息'] = f

print("识别到的数据文件:", file_map)

# --- 读取交易明细（主表） ---
df = pd.read_excel(file_map.get('交易明细', '交易明细.xlsx'))
print("=== 交易明细 ===")
print(f"形状: {df.shape}")
print(f"列名: {df.columns.tolist()}")
print(df.dtypes)
print(df.head(3))

# --- 读取辅助表 ---
df_person = None
df_account = None
df_subaccount = None

if '人员信息' in file_map:
    df_person = pd.read_excel(file_map['人员信息'])
    print(f"\n=== 人员信息 ===")
    print(f"形状: {df_person.shape}")
    print(f"列名: {df_person.columns.tolist()}")

if '账户信息' in file_map:
    df_account = pd.read_excel(file_map['账户信息'])
    print(f"\n=== 账户信息 ===")
    print(f"形状: {df_account.shape}")
    print(f"列名: {df_account.columns.tolist()}")

if '子账户信息' in file_map:
    df_subaccount = pd.read_excel(file_map['子账户信息'])
    print(f"\n=== 子账户信息 ===")
    print(f"形状: {df_subaccount.shape}")
    print(f"列名: {df_subaccount.columns.tolist()}")
```

### 检查主体账户数量

```python
# 确认数据中涉及几个主体账户
if COL['self_account'] in df.columns:
    accounts = df[COL['self_account']].unique()
    print(f"数据中涉及 {len(accounts)} 个主体账户: {accounts.tolist()}")
    if len(accounts) == 1:
        print("→ 单账户分析模式")
    else:
        print("→ 多账户分析模式，需在报告中列出所有涉案账户")
```

### 列名适配模板

```python
# 根据实际列名修改以下映射（以下为典型字段，按实际数据调整）
COL = {
    'time': '交易时间',           # 交易发生时间
    'amount': '交易金额',         # 交易金额（正数）
    'direction': '收付标志',      # 收入/支出方向（"进"/"出"）
    'balance': '交易余额',        # 交易后余额
    'opp_account': '交易对手账卡号',  # 对手账户号
    'opp_name': '对手户名',       # 对手户名
    'opp_id': '对手证件号',       # 对手证件号/身份证号
    'opp_bank': '对手开户银行',   # 对手开户银行
    'opp_balance': '对手交易余额', # 对手交易后余额（可选）
    'cash_flag': '现金标志',      # 现金/转账标志
    'memo': '摘要说明',           # 交易摘要/备注
    'self_account': '交易卡号',   # 本方交易卡号
    'self_name': '交易户名',      # 本方户名
    'self_id': '交易证件号',      # 本方证件号
    'ip': 'IP地址',              # IP地址
    'mac': 'MAC地址',            # MAC地址
    'location': '交易发生地',     # 交易发生地点
    'branch': '交易网点名称',     # 交易网点
    'success': '交易是否成功',    # 交易是否成功（1=成功）
    'currency': '交易币种',       # 币种
    'txn_serial': '交易流水号',   # 交易流水号
    'voucher': '凭证号',          # 凭证号
    'teller': '交易柜员号',       # 柜员号
}

# 收付方向的取值映射（根据实际数据调整）
DIR_IN = '进'    # 或 '收', '贷', 'C'
DIR_OUT = '出'   # 或 '付', '借', 'D'

# --- 数据预处理 ---
df = df.copy()
df[COL['time']] = pd.to_datetime(df[COL['time']])
df[COL['amount']] = pd.to_numeric(df[COL['amount']], errors='coerce').abs()

# 过滤失败交易
if COL['success'] in df.columns:
    total_before = len(df)
    df = df[df[COL['success']] == 1]
    print(f"过滤失败交易: {total_before - len(df)}笔, 剩余{len(df)}笔")

df_in = df[df[COL['direction']] == DIR_IN]
df_out = df[df[COL['direction']] == DIR_OUT]

print(f"收入: {len(df_in)}笔, 支出: {len(df_out)}笔")
```

### 辅助表关联

```python
# 构建对手证件号 → 人员信息的映射（用于报告中补充对手背景）
person_lookup = {}
if df_person is not None:
    person_col_id = '证照号码' if '证照号码' in df_person.columns else None
    if person_col_id:
        for _, row in df_person.iterrows():
            person_lookup[row[person_col_id]] = row.to_dict()
        print(f"人员信息已加载: {len(person_lookup)}条")

# 构建涉案账户信息汇总（用于报告"账户基本信息"章节）
if df_account is not None:
    print("\n=== 涉案账户信息 ===")
    for _, row in df_account.iterrows():
        name = row.get('账户开户名称', '未知')
        card = row.get('交易卡号', '未知')
        open_date = row.get('账号开户时间', '未知')
        branch = row.get('开户网点', '未知')
        acct_type = row.get('账户类型', '未知')
        status = row.get('账户状态', '未知')
        bank = row.get('账号开户银行', '未知')
        print(f"  {name}({card}): 开户时间={open_date}, 开户行={bank}, 网点={branch}, 类型={acct_type}, 状态={status}")

# 子账户信息汇总
if df_subaccount is not None:
    print(f"\n=== 子账户信息 ===")
    sub_summary = df_subaccount.groupby('子账户类别').agg(
        count=('子账户账号', 'count'),
        total_balance=('余额', 'sum')
    ).sort_values('total_balance', ascending=False)
    for cat, row in sub_summary.iterrows():
        print(f"  {cat}: {row['count']}个, 合计余额{row['total_balance']:,.2f}")
```

---

## 2. 基础统计（阶段A）

### 交易概况

```python
total_count = len(df)
total_amount = df[COL['amount']].sum()

in_count = len(df_in)
in_amount = df_in[COL['amount']].sum()
out_count = len(df_out)
out_amount = df_out[COL['amount']].sum()

date_min = df[COL['time']].min()
date_max = df[COL['time']].max()
date_span = (date_max - date_min).days

balance_ratio = abs(in_amount - out_amount) / (in_amount + out_amount) if (in_amount + out_amount) > 0 else 0

print(f"交易笔数: {total_count}, 总金额: {total_amount:,.2f}")
print(f"收入: {in_count}笔 / {in_amount:,.2f}元")
print(f"支出: {out_count}笔 / {out_amount:,.2f}元")
print(f"时间跨度: {date_min.date()} ~ {date_max.date()}, 共{date_span}天")
print(f"收支平衡度: {balance_ratio:.4f} ({balance_ratio*100:.2f}%)")
print(f"日均交易: {total_count / max(date_span, 1):.1f}笔")
```

### 年度趋势（含对手主体数）

```python
df['year'] = df[COL['time']].dt.year

# 基础年度统计
yearly = df.groupby(['year', COL['direction']]).agg(
    count=(COL['amount'], 'count'),
    total=(COL['amount'], 'sum')
).unstack(fill_value=0)

# 每年进出分别涉及多少个对手主体
yearly_opp = df.dropna(subset=[COL['opp_account']]).groupby(
    ['year', COL['direction']]
)[COL['opp_account']].nunique().unstack(fill_value=0)
yearly_opp.columns = [f'对手主体数_{c}' for c in yearly_opp.columns]

print("\n=== 年度交易趋势 ===")
print(yearly)
print("\n=== 年度对手主体数 ===")
print(yearly_opp)
```

### 金额分布

```python
bins = [0, 1000, 5000, 10000, 50000, 100000, 500000, float('inf')]
labels = ['0-1千', '1千-5千', '5千-1万', '1万-5万', '5万-10万', '10万-50万', '50万以上']

df['amount_bin'] = pd.cut(df[COL['amount']], bins=bins, labels=labels, right=True)

amount_dist = df.groupby([COL['direction'], 'amount_bin'], observed=True).size().unstack(fill_value=0)
print("\n=== 金额分布 ===")
print(amount_dist)
```

### 交易地理分布

```python
if COL['location'] in df.columns:
    location_stats = df.groupby(COL['location']).agg(
        count=(COL['amount'], 'count'),
        total=(COL['amount'], 'sum')
    ).sort_values('total', ascending=False)

    print("\n=== 交易地理分布 ===")
    for loc, row in location_stats.head(15).iterrows():
        print(f"  {loc}: {row['count']}笔, {row['total']:,.2f}元 ({row['total']/total_amount*100:.1f}%)")

    # 地理集中度：TOP5地区占总交易金额的比例
    top5_geo_ratio = location_stats['total'].head(5).sum() / total_amount * 100
    print(f"  TOP5地区集中度: {top5_geo_ratio:.1f}%")
```

### 对手开户银行分布

```python
if COL['opp_bank'] in df.columns:
    bank_dist = df.dropna(subset=[COL['opp_bank']]).groupby(COL['opp_bank']).agg(
        account_count=(COL['opp_account'], 'nunique'),
        txn_count=(COL['amount'], 'count'),
        total=(COL['amount'], 'sum')
    ).sort_values('account_count', ascending=False)

    print("\n=== 对手开户银行分布 ===")
    for bank, row in bank_dist.head(15).iterrows():
        print(f"  {bank}: {row['account_count']}个对手账户, {row['txn_count']}笔, {row['total']:,.2f}元")

    # 开户银行集中度
    total_opp_accounts = df[COL['opp_account']].dropna().nunique()
    top1_bank_accounts = bank_dist['account_count'].iloc[0] if len(bank_dist) > 0 else 0
    bank_conc = top1_bank_accounts / total_opp_accounts * 100 if total_opp_accounts > 0 else 0
    print(f"  TOP1开户银行集中度: {bank_conc:.1f}%")
```

### 现金交易统计

```python
if COL['cash_flag'] in df.columns:
    print(f"现金标志取值: {df[COL['cash_flag']].unique()}")

    cash_mask = df[COL['cash_flag']].astype(str).str.contains('现')
    cash_count = cash_mask.sum()
    cash_amount = df.loc[cash_mask, COL['amount']].sum()

    print(f"现金交易: {cash_count}笔 ({cash_count/total_count*100:.1f}%), "
          f"金额: {cash_amount:,.2f} ({cash_amount/total_amount*100:.1f}%)")
```

### 余额特征

```python
if COL['balance'] in df.columns:
    balances = pd.to_numeric(df[COL['balance']], errors='coerce').dropna()
    if len(balances) > 0:
        print(f"\n=== 余额特征 ===")
        print(f"最高余额: {balances.max():,.2f}")
        print(f"最低余额: {balances.min():,.2f}")
        print(f"平均余额: {balances.mean():,.2f}")
        sorted_df = df.sort_values(COL['time'])
        final_balance = pd.to_numeric(sorted_df[COL['balance']].iloc[-1], errors='coerce')
        print(f"最终余额: {final_balance:,.2f}")
```

---

## 3. 对手分析（阶段B）

### 收入/支出涉及账户数

```python
in_accounts = df_in[COL['opp_account']].dropna().nunique()
out_accounts = df_out[COL['opp_account']].dropna().nunique()
print(f"收入端涉及 {in_accounts} 个对手账户")
print(f"支出端涉及 {out_accounts} 个对手账户")
```

### TOP10 资金来源/去向

```python
def top_counterparties(df_subset, direction_label, n=10):
    """统计TOP-N对手账户，包含证件号用于关联人员信息"""
    grouped = df_subset.groupby([COL['opp_account'], COL['opp_name']]).agg(
        count=(COL['amount'], 'count'),
        total=(COL['amount'], 'sum'),
        avg=(COL['amount'], 'mean'),
        first_time=(COL['time'], 'min'),
        last_time=(COL['time'], 'max')
    ).sort_values('total', ascending=False)

    # 获取对手证件号
    opp_ids = df_subset.dropna(subset=[COL['opp_account'], COL.get('opp_id', '')]).drop_duplicates(
        subset=[COL['opp_account']]
    ).set_index(COL['opp_account'])[COL['opp_id']].to_dict() if COL.get('opp_id') and COL['opp_id'] in df_subset.columns else {}

    print(f"\n=== TOP{n} {direction_label} ===")
    for i, ((acct, name), row) in enumerate(grouped.head(n).iterrows(), 1):
        opp_id_info = opp_ids.get(acct, '未知')
        print(f"{i}. {name}({acct}): {row['count']}笔, "
              f"合计{row['total']:,.2f}, 均笔{row['avg']:,.2f}, 证件: {opp_id_info}")

    return grouped

in_top = top_counterparties(df_in, '资金来源')
out_top = top_counterparties(df_out, '资金去向')
```

### 对手背景信息补充

```python
# 对TOP对手通过证件号关联人员信息表
def get_person_info(opp_id, lookup):
    """通过证件号查询人员背景信息"""
    if not opp_id or opp_id == '未知' or not lookup:
        return None
    # 尝试精确匹配或前缀匹配（脱敏数据可能截断了部分号码）
    for key, info in lookup.items():
        if opp_id.startswith(key[:6]) or key.startswith(opp_id[:6]):
            return info
    return None

# 查看TOP对手的工作单位信息
if person_lookup:
    print("\n=== TOP对手人员背景 ===")
    for direction, df_top, top_data in [('来源', df_in, in_top), ('去向', df_out, out_top)]:
        print(f"\n--- {direction}端TOP10对手 ---")
        for i, ((acct, name), row) in enumerate(top_data.head(10).iterrows(), 1):
            opp_id = df_top[df_top[COL['opp_account']] == acct][COL.get('opp_id', '')].dropna().unique()
            opp_id = opp_id[0] if len(opp_id) > 0 else None
            info = get_person_info(opp_id, person_lookup)
            if info:
                work = info.get('工作单位', '未知')
                unit_addr = info.get('单位地址', '未知')
                legal = info.get('法人代表', '未知')
                print(f"  {i}. {name}: 工作单位={work}, 地址={unit_addr}, 法人={legal}")
            else:
                print(f"  {i}. {name}: 人员信息未匹配")
```

### 集中度计算

```python
def concentration(grouped_total, overall_total):
    """计算TOP1/3/5集中度"""
    cumsum = grouped_total.cumsum()
    result = {}
    for n in [1, 3, 5]:
        if len(cumsum) >= n:
            result[f'TOP{n}'] = cumsum.iloc[n-1] / overall_total * 100
        else:
            result[f'TOP{n}'] = cumsum.iloc[-1] / overall_total * 100
    return result

in_conc = concentration(in_top['total'], in_amount)
out_conc = concentration(out_top['total'], out_amount)

print(f"\n来源集中度: TOP1={in_conc['TOP1']:.1f}%, TOP3={in_conc['TOP3']:.1f}%, TOP5={in_conc['TOP5']:.1f}%")
print(f"去向集中度: TOP1={out_conc['TOP1']:.1f}%, TOP3={out_conc['TOP3']:.1f}%, TOP5={out_conc['TOP5']:.1f}%")
```

### 同名账户与双向交易

```python
# 主体户名（从数据中获取）
SELF_NAME = df[COL['self_name']].mode()[0] if COL['self_name'] in df.columns else '主体户名'

# 同名账户
same_name = df[df[COL['opp_name']] == SELF_NAME]
if len(same_name) > 0:
    same_name_accounts = same_name[COL['opp_account']].unique()
    print(f"\n同名账户: {len(same_name_accounts)}个, 交易{len(same_name)}笔, "
          f"金额{same_name[COL['amount']].sum():,.2f}")
    for acct in same_name_accounts:
        sub = same_name[same_name[COL['opp_account']] == acct]
        print(f"  - {acct}: {len(sub)}笔, {sub[COL['amount']].sum():,.2f}")

# 双向交易对手
in_set = set(df_in[COL['opp_account']].dropna().unique())
out_set = set(df_out[COL['opp_account']].dropna().unique())
bidirectional = in_set & out_set
print(f"\n双向交易对手: {len(bidirectional)}个")
for acct in sorted(bidirectional):
    name = df[df[COL['opp_account']] == acct][COL['opp_name']].iloc[0]
    in_amt = df_in[df_in[COL['opp_account']] == acct][COL['amount']].sum()
    out_amt = df_out[df_out[COL['opp_account']] == acct][COL['amount']].sum()
    print(f"  {name}({acct}): 进{in_amt:,.2f}, 出{out_amt:,.2f}")

# 自身转账（对手账户号包含主体账户号的记录）
SELF_ACCOUNT = df[COL['self_account']].mode()[0] if COL['self_account'] in df.columns else None
if SELF_ACCOUNT:
    self_transfer = df[df[COL['opp_account']] == SELF_ACCOUNT]
    if len(self_transfer) > 0:
        print(f"\n自身转账: {len(self_transfer)}笔, {self_transfer[COL['amount']].sum():,.2f}")
```

---

## 4. 团伙划分（阶段C）

### Union-Find 算法

```python
class UnionFind:
    """并查集，用于将共享IP/MAC的账户聚类为团伙"""

    def __init__(self):
        self.parent = {}
        self.rank = {}

    def find(self, x):
        if x not in self.parent:
            self.parent[x] = x
            self.rank[x] = 0
        if self.parent[x] != x:
            self.parent[x] = self.find(self.parent[x])
        return self.parent[x]

    def union(self, x, y):
        rx, ry = self.find(x), self.find(y)
        if rx == ry:
            return
        if self.rank[rx] < self.rank[ry]:
            rx, ry = ry, rx
        self.parent[ry] = rx
        if self.rank[rx] == self.rank[ry]:
            self.rank[rx] += 1

    def get_groups(self):
        groups = defaultdict(set)
        for x in self.parent:
            groups[self.find(x)].add(x)
        return dict(groups)
```

### 基于出账记录的 IP/MAC 聚类

```python
# 直接从交易明细中进行团伙分析（无需单独的对手数据文件）

# 1. 获取主体账户的出账对手列表
out_counterparties = set(df_out[COL['opp_account']].dropna().unique())
print(f"出账对手总数: {len(out_counterparties)}")

# 2. 从交易明细中筛选出账对手的"出"方向记录
#    注意：这里的"出"方向是指这些对手作为出账方（即交易卡号=对手账户）的记录
#    但如果数据中只有主体账户的交易明细，则我们用主体账户的出账记录来分析
#    关键：我们要找出哪些出账对手在"出"方向上使用了相同的IP/MAC

# 方法一：如果交易明细中包含对手账户的交易（多账户明细），
# 可以直接筛选交易卡号在出账对手列表中的记录
out_cp_records = df[df[COL['self_account']].isin(out_counterparties)]
# 进一步筛选出方向
out_cp_out = out_cp_records[out_cp_records[COL['direction']] == DIR_OUT].copy()
print(f"出账对手的出方向交易记录数: {len(out_cp_out)}")

# 方法二：如果交易明细只有主体账户的记录（无法看到对手的行为），
# 则用主体账户出账时的对手信息进行关联分析
# 此时IP/MAC可能代表的是交易发生的设备信息

# 以下以方法一为示例（多账户明细模式）：
has_ip = COL.get('ip') and COL['ip'] in out_cp_out.columns
has_mac = COL.get('mac') and COL['mac'] in out_cp_out.columns
print(f"IP列存在: {has_ip}, MAC列存在: {has_mac}")

# 3. 统计每个IP/MAC在出账方向上关联的交易卡号数量
if has_ip:
    ip_out = out_cp_out.dropna(subset=[COL['ip']])
    ip_account_count = ip_out.groupby(COL['ip'])[COL['self_account']].nunique()
    shared_ips = ip_account_count[ip_account_count >= 2]
    print(f"\n共享IP（出方向，关联>=2个卡号）: {len(shared_ips)}个")
    for ip, cnt in shared_ips.sort_values(ascending=False).head(20).items():
        accounts = ip_out[ip_out[COL['ip']] == ip][COL['self_account']].unique()
        print(f"  {ip}: 涉及{cnt}个主体卡号 → {accounts.tolist()[:10]}")

if has_mac:
    mac_out = out_cp_out.dropna(subset=[COL['mac']])
    mac_account_count = mac_out.groupby(COL['mac'])[COL['self_account']].nunique()
    shared_macs = mac_account_count[mac_account_count >= 2]
    print(f"\n共享MAC（出方向，关联>=2个卡号）: {len(shared_macs)}个")
    for mac, cnt in shared_macs.sort_values(ascending=False).head(20).items():
        accounts = mac_out[mac_out[COL['mac']] == mac][COL['self_account']].unique()
        print(f"  {mac}: 涉及{cnt}个主体卡号 → {accounts.tolist()[:10]}")

# 4. Union-Find 聚类
if has_ip or has_mac:
    ip_data = out_cp_out.dropna(subset=[COL['ip']]) if has_ip else pd.DataFrame()
    mac_data = out_cp_out.dropna(subset=[COL['mac']]) if has_mac else pd.DataFrame()

    accounts_with_device = set()
    if len(ip_data) > 0:
        accounts_with_device |= set(ip_data[COL['self_account']].unique())
    if len(mac_data) > 0:
        accounts_with_device |= set(mac_data[COL['self_account']].unique())

    print(f"\n有设备信息的出账对手: {len(accounts_with_device)}个")

    uf = UnionFind()

    if has_ip and len(ip_data) > 0:
        for ip, group in ip_data.groupby(COL['ip']):
            accounts = group[COL['self_account']].unique().tolist()
            for i in range(1, len(accounts)):
                uf.union(accounts[0], accounts[i])

    if has_mac and len(mac_data) > 0:
        for mac, group in mac_data.groupby(COL['mac']):
            accounts = group[COL['self_account']].unique().tolist()
            for i in range(1, len(accounts)):
                uf.union(accounts[0], accounts[i])

    for acct in accounts_with_device:
        uf.find(acct)

    gangs = uf.get_groups()
    gangs = {k: v for k, v in gangs.items() if len(v) >= 2}

    print(f"\n识别出 {len(gangs)} 个团伙（>=2人）:")
    for i, (root, members) in enumerate(sorted(gangs.items(), key=lambda x: -len(x[1])), 1):
        print(f"\n--- 团伙{i} ({len(members)}人) ---")
        for m in sorted(members):
            txn = df_out[df_out[COL['opp_account']] == m]
            amt = txn[COL['amount']].sum() if len(txn) > 0 else 0
            cnt = len(txn)
            print(f"  {m}: 与主体交易{cnt}笔, {amt:,.2f}元")
```

### 基于对手证件号前6位的地域聚合

```python
if COL.get('opp_id') and COL['opp_id'] in df.columns:
    df_id = df.dropna(subset=[COL['opp_account'], COL['opp_id']])[
        [COL['opp_account'], COL['opp_name'], COL['opp_id']]
    ].drop_duplicates(subset=[COL['opp_account']])

    # 提取前6位（户籍地区划代码）
    df_id['id_prefix6'] = df_id[COL['opp_id']].astype(str).str[:6]
    # 过滤无效值（非6位数字开头）
    df_id = df_id[df_id['id_prefix6'].str.match(r'^\d{6}', na=False)]

    # 按前6位分组，统计每组有多少个不同账户
    region_groups = df_id.groupby('id_prefix6').agg(
        accounts=(COL['opp_account'], lambda x: set(x)),
        count=(COL['opp_account'], 'count'),
        names=(COL['opp_name'], list)
    )
    region_gangs = region_groups[region_groups['accounts'].apply(len) >= 2]

    total_opp_with_id = df_id[COL['opp_account']].nunique()

    print(f"\n=== 对手证件号地域聚合 ===")
    print(f"有证件号的对手: {total_opp_with_id}个")
    print(f"同地域组（>=2人）: {len(region_gangs)}组")

    for prefix, row in region_gangs.iterrows():
        accounts = row['accounts']
        print(f"\n  地区代码 {prefix}: {len(accounts)}个对手账户")
        for acct in sorted(accounts):
            name_rows = df[df[COL['opp_account']] == acct]
            name = name_rows[COL['opp_name']].iloc[0] if len(name_rows) > 0 else '未知'
            txn = df_out[df_out[COL['opp_account']] == acct]
            print(f"    {name}({acct}): 与主体交易{len(txn)}笔, {txn[COL['amount']].sum():,.2f}元")

    # 地域集中度
    if len(region_gangs) > 0:
        max_region = region_gangs['accounts'].apply(len).max()
        region_conc = max_region / total_opp_with_id * 100
        print(f"\n最大地域组占比: {max_region}/{total_opp_with_id} = {region_conc:.1f}%")
```

### 基于对手开户银行的聚类

```python
if COL.get('opp_bank') and COL['opp_bank'] in df.columns:
    bank_accounts = df.dropna(subset=[COL['opp_account'], COL['opp_bank']]).drop_duplicates(
        subset=[COL['opp_account']]
    )

    bank_groups = bank_accounts.groupby(COL['opp_bank']).agg(
        account_count=(COL['opp_account'], 'count'),
        accounts=(COL['opp_account'], list)
    ).sort_values('account_count', ascending=False)

    # 找出开户在同一银行的对手（>=2个账户）
    bank_gangs = bank_groups[bank_groups['account_count'] >= 2]

    print(f"\n=== 对手开户银行聚类 ===")
    print(f"有开户银行信息的对手: {bank_accounts[COL['opp_account']].nunique()}个")
    print(f"同银行组（>=2人）: {len(bank_gangs)}组")

    for bank, row in bank_gangs.head(10).iterrows():
        accounts = row['accounts']
        total_amt = sum(
            df_out[df_out[COL['opp_account']] == acct][COL['amount']].sum()
            for acct in accounts
        )
        print(f"  {bank}: {row['account_count']}个对手账户, 与主体交易合计{total_amt:,.2f}元")
```

### 基于交易关系的团伙拓展

```python
# 同名账户拓展
opp_names = df[COL['opp_name']].dropna()
name_counts = opp_names.value_counts()
multi_account_names = name_counts[name_counts >= 2].index.tolist()

print("\n=== 同名多户 ===")
for name in multi_account_names:
    accounts = df[df[COL['opp_name']] == name][COL['opp_account']].unique()
    total = df[df[COL['opp_name']] == name][COL['amount']].sum()
    print(f"{name}: {len(accounts)}个账户, 合计{total:,.2f}元")

# 高频交易对手（潜在稳定关系）
freq_threshold = 10  # 交易次数阈值，可调整
opp_freq = df.groupby(COL['opp_account']).size()
high_freq = opp_freq[opp_freq >= freq_threshold]
if len(high_freq) > 0:
    print(f"\n=== 高频对手（>={freq_threshold}笔）===")
    for acct, cnt in high_freq.sort_values(ascending=False).items():
        name = df[df[COL['opp_account']] == acct][COL['opp_name']].iloc[0] if len(df[df[COL['opp_account']] == acct]) > 0 else '未知'
        print(f"  {name}({acct}): {cnt}笔")
```

---

## 5. 可疑特征量化（阶段D）

### 核心指标自动计算

```python
results = {}

# 1. 收支平衡度
results['收支平衡度'] = abs(in_amount - out_amount) / (in_amount + out_amount) if (in_amount + out_amount) > 0 else None

# 2. 现金交易占比
if COL.get('cash_flag') and COL['cash_flag'] in df.columns:
    cash_mask = df[COL['cash_flag']].astype(str).str.contains('现')
    results['现金交易占比'] = cash_mask.sum() / total_count
else:
    results['现金交易占比'] = None

# 3. 对手集中度(来源)
if len(in_top) >= 3:
    results['来源集中度TOP3'] = in_top['total'].head(3).sum() / in_amount
else:
    results['来源集中度TOP3'] = in_top['total'].sum() / in_amount if in_amount > 0 else None

# 4. 对手集中度(去向)
if len(out_top) >= 3:
    results['去向集中度TOP3'] = out_top['total'].head(3).sum() / out_amount
else:
    results['去向集中度TOP3'] = out_top['total'].sum() / out_amount if out_amount > 0 else None

# 5. 同名账户数
results['同名账户数'] = df[df[COL['opp_name']] == SELF_NAME][COL['opp_account']].nunique()

# 6. 整额交易占比（整万）
round_10k = df[df[COL['amount']] % 10000 == 0]
results['整万交易占比'] = len(round_10k) / total_count if total_count > 0 else 0
# 整千占比
round_1k = df[df[COL['amount']] % 1000 == 0]
results['整千交易占比'] = len(round_1k) / total_count if total_count > 0 else 0

# 7. 快进快出天数占比
df['date'] = df[COL['time']].dt.date
daily_in = df_in.groupby(df_in[COL['time']].dt.date)[COL['amount']].sum()
daily_out = df_out.groupby(df_out[COL['time']].dt.date)[COL['amount']].sum()
daily = pd.DataFrame({'in': daily_in, 'out': daily_out}).fillna(0)
quick_days = ((daily['in'] > 50000) & (daily['out'] > 50000)).sum()
total_days = df['date'].nunique()
results['快进快出天数占比'] = quick_days / total_days if total_days > 0 else 0

# 8. 资金周转率
if COL['balance'] in df.columns:
    avg_balance = pd.to_numeric(df[COL['balance']], errors='coerce').mean()
    results['资金周转率'] = total_amount / avg_balance if avg_balance > 0 else None
else:
    results['资金周转率'] = None

# 9. 可疑关键词
if COL.get('memo') and COL['memo'] in df.columns:
    keywords = ['换汇', '换钱', '换币', '兑换', '换美金', '换美元', '外汇']
    pattern = '|'.join(keywords)
    keyword_mask = df[COL['memo']].astype(str).str.contains(pattern, na=False)
    results['可疑关键词笔数'] = keyword_mask.sum()
else:
    results['可疑关键词笔数'] = None

# 10. 地域集中度（补充指标）
if COL.get('opp_id') and COL['opp_id'] in df.columns:
    opp_ids = df.dropna(subset=[COL['opp_account'], COL['opp_id']]).drop_duplicates(subset=[COL['opp_account']])
    opp_ids['prefix6'] = opp_ids[COL['opp_id']].astype(str).str[:6]
    valid_ids = opp_ids[opp_ids['prefix6'].str.match(r'^\d{6}', na=False)]
    if len(valid_ids) > 0:
        max_region_count = valid_ids['prefix6'].value_counts().max()
        results['地域集中度'] = max_region_count / len(valid_ids)
    else:
        results['地域集中度'] = None
else:
    results['地域集中度'] = None

# 11. 对手开户银行集中度（补充指标）
if COL.get('opp_bank') and COL['opp_bank'] in df.columns:
    opp_banks = df.dropna(subset=[COL['opp_account'], COL['opp_bank']]).drop_duplicates(subset=[COL['opp_account']])
    if len(opp_banks) > 0:
        top1_bank = opp_banks[COL['opp_bank']].value_counts().max()
        results['开户银行集中度'] = top1_bank / len(opp_banks)
    else:
        results['开户银行集中度'] = None
else:
    results['开户银行集中度'] = None
```

### 阈值判定与输出

```python
thresholds = {
    '收支平衡度':        {'normal': 0.20, 'abnormal': 0.05, 'high': 0.01, 'direction': 'lower'},
    '现金交易占比':      {'normal': 0.20, 'abnormal': 0.50, 'high': 0.70, 'direction': 'higher'},
    '来源集中度TOP3':    {'normal': 0.30, 'abnormal': 0.40, 'high': 0.60, 'direction': 'higher'},
    '去向集中度TOP3':    {'normal': 0.30, 'abnormal': 0.40, 'high': 0.60, 'direction': 'higher'},
    '同名账户数':        {'normal': 0,    'abnormal': 2,    'high': 5,    'direction': 'higher'},
    '整万交易占比':      {'normal': 0.15, 'abnormal': 0.30, 'high': 0.45, 'direction': 'higher'},
    '快进快出天数占比':  {'normal': 0.05, 'abnormal': 0.10, 'high': 0.20, 'direction': 'higher'},
    '资金周转率':        {'normal': 20,   'abnormal': 50,   'high': 100,  'direction': 'higher'},
    '可疑关键词笔数':    {'normal': 0,    'abnormal': 1,    'high': 10,   'direction': 'higher'},
    '地域集中度':        {'normal': 0.10, 'abnormal': 0.20, 'high': 0.30, 'direction': 'higher'},
    '开户银行集中度':    {'normal': 0.20, 'abnormal': 0.30, 'high': 0.40, 'direction': 'higher'},
}

print("\n=== 可疑指标判定结果 ===")
for name, value in results.items():
    if value is None:
        print(f"  {name}: 无法计算（缺少数据）")
        continue

    th = thresholds.get(name)
    if th is None:
        print(f"  {name}: {value}")
        continue

    if th['direction'] == 'lower':
        if value < th['high']:
            level = '高度异常'
        elif value < th['abnormal']:
            level = '异常'
        else:
            level = '正常'
    else:
        if value >= th['high']:
            level = '高度异常'
        elif value >= th['abnormal']:
            level = '异常'
        else:
            level = '正常'

    if isinstance(value, float) and value < 1:
        display = f"{value*100:.2f}%"
    else:
        display = f"{value}"

    marker = '高度异常' if level == '高度异常' else ('异常' if level == '异常' else '正常')
    print(f"  [{marker}] {name}: {display} → {level}")
```

---

## 6. 快进快出检测（30分钟窗口）

```python
def find_quick_pairs(df, col_time, col_amount, col_direction, dir_in, dir_out, window_minutes=30):
    """
    检测30分钟内的快进快出配对。
    返回配对列表 [(进账时间, 进账金额, 出账时间, 出账金额, 间隔分钟), ...]
    """
    df_sorted = df.sort_values(col_time).copy()
    ins = df_sorted[df_sorted[col_direction] == dir_in][[col_time, col_amount]].values
    outs = df_sorted[df_sorted[col_direction] == dir_out][[col_time, col_amount]].values

    pairs = []
    used_outs = set()

    for in_time, in_amt in ins:
        if in_amt < 50000:  # 只关注大额
            continue
        for j, (out_time, out_amt) in enumerate(outs):
            if j in used_outs or out_amt < 50000:
                continue
            diff = (out_time - in_time)
            if hasattr(diff, 'total_seconds'):
                diff_minutes = diff.total_seconds() / 60
            else:
                diff_minutes = float(diff) / 60e9  # numpy timedelta

            if 0 < diff_minutes <= window_minutes:
                pairs.append((in_time, float(in_amt), out_time, float(out_amt), diff_minutes))
                used_outs.add(j)
                break

    return pairs

pairs = find_quick_pairs(
    df, COL['time'], COL['amount'], COL['direction'], DIR_IN, DIR_OUT, window_minutes=30
)

print(f"\n=== 30分钟快进快出配对: {len(pairs)}对 ===")
for in_t, in_a, out_t, out_a, mins in pairs[:20]:
    print(f"  进: {in_t} ({in_a:,.0f}) → 出: {out_t} ({out_a:,.0f}), 间隔{mins:.0f}分钟")
```

---

## 7. 资金穿透分析

```python
def fund_penetration(df_main, target_accounts, col_self, col_opp, col_amount, col_direction, dir_in, dir_out, depth=1):
    """
    从交易明细中进行资金穿透分析。
    target_accounts: 待穿透的账户列表
    对每个账户，统计其作为交易卡号时的上/下游资金关系。
    """
    result = {}
    for acct in target_accounts:
        # 作为交易卡号的记录
        acct_data = df_main[df_main[col_self] == acct]
        if len(acct_data) == 0:
            # 也检查交易账号
            acct_data = df_main[df_main.get('交易账号', col_self)] if '交易账号' in df_main.columns else pd.DataFrame()
            if len(acct_data) == 0:
                continue

        # 上游（给 acct 转入的来源）
        upstream = acct_data[acct_data[col_direction] == dir_in].groupby(col_opp)[col_amount].agg(['sum', 'count']).sort_values('sum', ascending=False)
        # 下游（acct 转出的去向）
        downstream = acct_data[acct_data[col_direction] == dir_out].groupby(col_opp)[col_amount].agg(['sum', 'count']).sort_values('sum', ascending=False)

        result[acct] = {
            'upstream_top5': upstream.head(5),
            'downstream_top5': downstream.head(5),
            'total_in': acct_data[acct_data[col_direction] == dir_in][col_amount].sum(),
            'total_out': acct_data[acct_data[col_direction] == dir_out][col_amount].sum(),
        }

    return result

# 对TOP来源和去向的账户做穿透
top_sources = in_top.head(5).index.get_level_values(0).tolist()
top_targets = out_top.head(5).index.get_level_values(0).tolist()

penetration = fund_penetration(
    df,
    top_sources + top_targets,
    COL['self_account'],
    COL['opp_account'],
    COL['amount'],
    COL['direction'],
    DIR_IN, DIR_OUT
)

for acct, info in penetration.items():
    print(f"\n--- {acct} ---")
    print(f"总收入: {info['total_in']:,.2f}, 总支出: {info['total_out']:,.2f}")
    if len(info['upstream_top5']) > 0:
        print("  TOP5上游:")
        print(info['upstream_top5'].to_string())
    if len(info['downstream_top5']) > 0:
        print("  TOP5下游:")
        print(info['downstream_top5'].to_string())
```

---

## 8. 报告生成辅助

### Markdown 格式化表格

```python
def to_md_table(headers, rows):
    """将数据转为 Markdown 表格字符串"""
    lines = []
    lines.append('| ' + ' | '.join(str(h) for h in headers) + ' |')
    lines.append('| ' + ' | '.join('---' for _ in headers) + ' |')
    for row in rows:
        lines.append('| ' + ' | '.join(str(v) for v in row) + ' |')
    return '\n'.join(lines)

# 使用示例
headers = ['序号', '对手账户', '对手户名', '交易笔数', '合计金额', '平均单笔']
rows = []
for i, ((acct, name), row) in enumerate(in_top.head(10).iterrows(), 1):
    rows.append([i, acct, name, row['count'], f"{row['total']:,.2f}", f"{row['avg']:,.2f}"])

table_str = to_md_table(headers, rows)
print(table_str)
```

### Word 报告生成（使用 python-docx）

```python
from docx import Document
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_PARAGRAPH_ALIGNMENT

def create_report():
    doc = Document()

    # 标题
    title = doc.add_heading('资金分析报告', level=0)
    title.alignment = WD_PARAGRAPH_ALIGNMENT.CENTER

    # 正文段落
    doc.add_heading('一、基本情况', level=1)
    doc.add_heading('（一）账户基本信息', level=2)
    doc.add_paragraph('此处填写账户基本信息...')

    # 表格
    table = doc.add_table(rows=1, cols=4)
    table.style = 'Table Grid'
    headers = table.rows[0].cells
    headers[0].text = '项目'
    headers[1].text = '笔数'
    headers[2].text = '金额'
    headers[3].text = '占比'

    # 添加数据行
    row = table.add_row().cells
    row[0].text = '收入'
    row[1].text = str(in_count)
    row[2].text = f'{in_amount:,.2f}'
    row[3].text = f'{in_amount/total_amount*100:.1f}%'

    doc.save('资金分析报告.docx')
    print("报告已生成: 资金分析报告.docx")

# create_report()  # 取消注释执行
```

### f-string 防错规范（重要）

生成 Word 报告时，所有包含变量引用的字符串**必须使用 f-string**（在引号前加 `f` 前缀），否则 `{变量名}` 会作为字面量原样输出到文档中。

**错误写法**（变量不会被求值，直接输出 `{r["in_accounts"]}` 这样的文字）：
```python
doc.add_paragraph('该账户收入{in_count}笔，支出{out_count}笔')  # 缺少 f 前缀！
doc.add_paragraph('上游{r["in_accounts"]}个对手')                # 缺少 f 前缀！
```

**正确写法**（变量会被正确求值并替换为真实数据）：
```python
doc.add_paragraph(f'该账户收入{in_count}笔，支出{out_count}笔')
doc.add_paragraph(f'上游{r["in_accounts"]}个对手')
```

**检查方法**：生成报告后，打开 docx 文件搜索 `{` 字符。如果文档中出现 `{r[`、`{in_count}` 等原始占位符文本，说明有字符串遗漏了 `f` 前缀，需要逐一排查修复。
