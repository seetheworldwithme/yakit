# 经侦分析代码参考库

> 本文档为SKILL-jingzhen-analysis.md的配套代码参考库

---

## 一、战法编写规范

### 1.1 基础战法模板

```python
# -*- encoding:utf-8 -*-

def methodExec(inJsonParams):
    """
    自定义战法的执行入口
    inJsonParams: 主程序初始化的Json数据
    返回: result_map 结果字典
    """
    print("============ 战法执行开始 ============")
    result_map = {}

    try:
        # 执行分析逻辑
        result_map['status'] = 'ok'

        row_data = {}
        row_data['titles'] = ['列名1', '列名2', '列名3']
        row_data['titleType'] = {
            'int': ['id字段'],
            'float': ['金额字段'],
            'datetime': ['时间字段']
        }
        row_data['data'] = [
            ('值1', '值2', '值3'),
            ('值1', '值2', '值3')
        ]

        result_map['rowData'] = row_data
        print("============ 战法执行结束 ============")
        return result_map

    except Exception as e:
        print(e)
        result_map['status'] = 'error'
        print("============ 战法执行结束 ============")
        return result_map
```

### 1.2 数据库查询战法模板

```python
# -*- encoding:utf-8 -*-
import hyjj.utilities as method

def methodExec(inJsonParams):
    print("============ 战法执行开始 ============")
    result_map = {}

    try:
        # 连接数据库
        sqlite_conn = method.openDbConnector()

        # 构建SQL查询
        db_sql = '''
            SELECT `查询卡号`,`客户名称`,`交易对方卡号`,`交易对方名称`,
                   `交易时间`,`交易金额`,`借贷标志`,`交易类型`,`交易摘要`
            FROM 银行交易流水
            LIMIT 100
        '''
        cursor = sqlite_conn.execute(db_sql)

        result_map['status'] = 'ok'
        row_data = {}
        row_data['titles'] = ['查询卡号','客户名称','交易对方卡号','交易对方名称',
                              '交易时间','交易金额','借贷标志','交易类型','交易摘要']
        row_data['titleType'] = {
            'float': ['交易金额'],
            'datetime': ['交易时间']
        }

        row_data['data'] = []
        for row in cursor:
            row_data['data'].append(row)

        result_map['rowData'] = row_data

        # 可选：将数据展示到图表
        # method.display2Chart('战法名称', '图表模板名', '表名', rowIds)

        method.closeDbConnector(sqlite_conn)
        print("============ 战法执行结束 ============")
        return result_map

    except Exception as e:
        print(e)
        result_map['status'] = 'error'
        return result_map
```

### 1.3 返回结果结构规范

```python
result_map = {
    'status': 'ok',  # 或 'error'

    'rowData': {
        'titles': ['列名1', '列名2', ...],      # 表头列表
        'titleType': {                           # 列类型定义
            'int': ['整数字段'],
            'float': ['浮点数字段'],
            'datetime': ['时间字段']
        },
        'data': [                                # 数据行列表
            (值1, 值2, ...),
            (值1, 值2, ...),
        ]
    },

    # 可选：图表展示配置
    'elpData': {
        'elpName': 'ELP模板名称',
        'tableName': '数据表名',
        'dataSource': [id列表]
    }
}
```

---

## 二、数据清洗脚本模板

### 2.1 数据清洗入口函数

```python
# -*- encoding:utf-8 -*-

from PythonQt import hyjjpurerapi
from PythonQt.hyjjpurerapi import PluginExchangeDataInterface
import pandas as pd

def exec(dataId):
    """
    数据清洗执行入口
    dataId: 数据接口ID
    """
    print("============ start pure ============")

    # 获取数据接口
    file = hyjjpurerapi.getDataInterface(dataId)
    strfileName = file.getCurrentFileName()
    strSheetName = file.getCurrentSheetName()
    ititleIndex = file.getTitleIndex(strfileName, strSheetName)
    totalRowSize = file.getRowSize(strfileName, strSheetName)
    totalColumnSize = file.getColumnSize(strfileName, strSheetName)

    # 执行清洗逻辑
    # ...

    # 回写清洗后的数据
    # file.setContent(filename, sheetname, col, row, content)

    print("============ end pure ============")
```

### 2.2 银行账户信息清洗脚本

```python
# -*- coding:utf-8 -*-
import pandas as pd
from PythonQt import hyjjpurerapi

def get_desc():
    """返回清洗规则描述"""
    dic_desc = {
        "version": "1.0",
        "destTable": "账户开户信息",
        "columnNames": ["协议号","发卡机构号","卡折分类代码","姓名","发卡日期"],
        "columnMapping": {
            "账户开户名称": "姓名",
            "交易卡号": "协议号",
            "账号开户时间": "发卡日期"
        }
    }
    return json.JSONEncoder().encode(dic_desc)

def exec(dataId):
    file = hyjjpurerapi.getDataInterface(dataId)
    strfileName = file.getCurrentFileName()
    strSheetName = file.getCurrentSheetName()

    # 读取Excel多个Sheet
    xls_file1 = pd.ExcelFile(strfileName)
    df1 = xls_file1.parse('存折、卡等账户信息')
    df2 = xls_file1.parse('基本信息')
    df3 = xls_file1.parse('卡账户余额信息')

    # 合并数据
    df2 = df2[['核心客户号', '开户日期', '通讯地址', '手机号码', '工作单位', '证件号码']]
    df_data = df1.merge(df2, on='核心客户号', how='left')

    df3 = df3[['卡号', '余额']]
    s1 = df3.groupby('卡号').last()['余额']
    df3 = pd.DataFrame({'协议号': s1.index, '余额': s1.values})
    df_data = df_data.merge(df3, on='协议号', how='left')

    # 回写数据
    for idx in df_data.index:
        file.setContent(strfileName, strSheetName, 0, idx + 1, df_data.loc[idx, '姓名'])
        file.setContent(strfileName, strSheetName, 2, idx + 1, df_data.loc[idx, '协议号'])
        # ... 其他字段
```

---

## 三、反洗钱数据处理逻辑

### 3.1 数据分块处理

```python
def splite_data(in_file):
    """
    按主控人拆分交易数据
    适用于：公经反洗钱协查数据
    """
    xls_file1 = pd.ExcelFile(in_file)
    df3 = xls_file1.parse('交易明细附件列表')

    # 获取数据分块的起点（"序号"行为分界）
    df_index = df3.loc[df3.iloc[:,0] == '序号',:].index.tolist()

    # 计算数据分块的起点和终点
    index_reg = {}
    for c in range(len(df_index)-1):
        index_reg[df_index[c]] = df_index[c+1]-3
    index_reg[df_index[-1]] = len(df3.index)

    # 提取数据分块, key:主控人， value:主控人的所有数据
    data_map = {}
    for i in df_index:
        # 提取主控人姓名
        key = str(df3.iloc[i-1,0])
        key = key[key.find(')')+1:]  # 去除序号前缀

        data = df3.iloc[i+1:index_reg[i],:]
        data.columns = df3.iloc[i]
        data_map[key] = data

    return data_map
```

### 3.2 借贷方向统一处理

```python
def trans_df(df_map):
    """
    统一付款方/收款方格式
    将所有交易统一为：付款方=主控账户，收款方=交易对方
    """
    # 标准输出字段
    df_all = pd.DataFrame(columns=[
        '交易时间', '交易方式', '付款方账号', '付款方名称', '付款方证件号码',
        '付款方银行', '收款方账号', '收款方名称', '收款方证件号码', '收款方银行',
        '货币名称', '原币金额', '交易记录ID', '报告机构', '交易发生地', '用途', '借贷标志'
    ])

    for key in df_map.keys():
        df_data = df_map[key]

        # 默认借贷标志为"出"（付款方是主控人）
        df_data['借贷标志'] = '出'

        # 识别收款方为主控人的情况
        row_flag = ((df_data.收款方名称 == key) & (df_data.付款方名称 != key)).copy()
        df_data.loc[row_flag, '借贷标志'] = '进'

        # 交换付款方和收款方信息
        swap_map = {
            '收款方账号': '付款方账号',
            '收款方名称': '付款方名称',
            '收款方证件号码': '付款方证件号码',
            '收款方银行': '付款方银行'
        }
        for col in swap_map:
            temp_data = df_data.loc[row_flag, col]
            df_data.loc[row_flag, col] = df_data.loc[row_flag, swap_map[col]]
            df_data.loc[row_flag, swap_map[col]] = temp_data

        df_all = df_all.append(df_data)

    return df_all
```

---

## 四、时间格式标准化

### 4.1 时间转换函数

```python
def time_format_fun(row_data):
    """
    标准化时间格式
    输入: yyyyMMdd 或 yyyyMMddHHmm 或 yyyyMMddHHmmss
    输出: YYYY-MM-DD HH:MM:SS
    """
    row_data = str(row_data).replace('t', '').replace('T', '')

    if len(row_data) == len('yyyyMMdd'):
        return row_data[:4] + '-' + row_data[4:6] + '-' + row_data[6:8] + ' 00:00:00'

    if len(row_data) == len('yyyyMMddHHmm'):
        return row_data[:4] + '-' + row_data[4:6] + '-' + row_data[6:8] + ' ' + \
               row_data[8:10] + ':' + row_data[10:12] + ':00'

    if len(row_data) == len('yyyyMMddHHmmss'):
        return row_data[:4] + '-' + row_data[4:6] + '-' + row_data[6:8] + ' ' + \
               row_data[8:10] + ':' + row_data[10:12] + ':' + row_data[12:14]

    return row_data  # 无法识别则原样返回

# 使用示例
# df['交易时间'] = df['交易时间'].apply(time_format_fun)
```

### 4.2 日期格式转换（带分隔符）

```python
def date_format_convert(date_str):
    """
    转换日期格式
    输入: 2024/01/15 或 2024.01.15
    输出: 2024-01-15
    """
    if pd.isna(date_str):
        return ''
    return str(date_str).replace('/', '-').replace('.', '-')
```

---

## 五、字段映射规则

### 5.1 智能字段匹配

```python
# mappingrule.json 中的匹配规则示例

mapping_rules = [
    {
        "name": "交易时间",
        "rule": [["时间"], ["日期"]]
    },
    {
        "name": "交易金额",
        "rule": [["交易", "额"], ["发生", "额"]],
        "type": 1  # 数值类型
    },
    {
        "name": "借贷标志",
        "rule": [
            ["收", "付"],
            ["借", "贷"],
            ["进", "出"],
            ["D", "C"],
            ["借", "方向"],
            ["存", "取"]
        ]
    },
    {
        "name": "查询卡号",
        "rule": [
            ["交易介质"],
            ["卡号"],
            ["账号"],
            ["帐号"],
            ["账户"],
            ["付款账号"]
        ],
        "type": 0  # 字符串类型
    },
    {
        "name": "交易对方名称",
        "rule": [
            ["对", "户名"],
            ["对", "名称"],
            ["对", "姓名"],
            ["收", "户名"]
        ]
    },
    {
        "name": "交易对方卡号",
        "rule": [
            ["对", "卡号"],
            ["对", "账号"],
            ["对", "帐号"],
            ["对", "账户"],
            ["收款账号"]
        ],
        "type": 0
    }
]

def match_field(field_name, rules):
    """
    根据规则匹配标准字段名
    field_name: 原始字段名
    rules: 映射规则列表
    返回: 标准字段名 或 None
    """
    for rule in rules:
        for condition in rule['rule']:
            # 所有条件都需要满足
            if all(keyword in field_name for keyword in condition):
                return rule['name']
    return None
```

---

## 六、代码转换函数

### 6.1 MCC商户码转换

```python
import pickle

def mcc_replace(mcc_code):
    """
    MCC商户类型码转换
    输入: MCC码（如 5812）
    输出: 商户类型（如 "餐馆"）
    """
    with open('./data/mcc.map', 'rb') as f:
        mcc_map = pickle.load(f)

    code = str(mcc_code).strip()

    if code in mcc_map:
        return mcc_map[code]
    else:
        return '空'

# 使用示例
# df['商户类型'] = df['MCC码'].apply(mcc_replace)
```

### 6.2 银行代码转换

```python
def bank_code_replace(code, map_type):
    """
    银行代码转换
    map_type: 'acqbank'(收单机构), 'issuebank'(发卡机构)
    """
    map_file = f'./data/{map_type}.map'
    with open(map_file, 'rb') as f:
        code_map = pickle.load(f)

    code = str(code).strip()

    if code in code_map:
        return code_map[code]
    else:
        return '空'
```

### 6.3 交易代码/渠道转换

```python
def transcode_replace(trans_code):
    """交易代码转换"""
    with open('./data/transcode.map', 'rb') as f:
        code_map = pickle.load(f)
    return code_map.get(str(trans_code).strip(), '空')

def transchnl_replace(chnl_code):
    """交易渠道转换"""
    with open('./data/trans_chnl.map', 'rb') as f:
        code_map = pickle.load(f)
    return code_map.get(str(chnl_code).strip(), '空')

def returncode_replace(ret_code):
    """交易返回码转换"""
    with open('./data/returncode.map', 'rb') as f:
        code_map = pickle.load(f)
    return code_map.get(str(ret_code).strip(), '空')
```

---

## 七、数据引擎核心函数

### 7.1 多数据源读取

```python
import sqlite3
import pymysql
import pandas as pd

def open_file(connect_info, filename, sheetname, header_index):
    """
    多数据源文件读取
    支持: CSV/XLS/XLSX/SQLite/MySQL
    """
    if connect_info['pluginID'] == '{74b92fec-884f-43fb-a808-1946ec0f83fb}':
        # 文件类型
        filename = connect_info['baseFileName']
        dir_path = connect_info['file']
        filename = dir_path + '/' + filename
        ext = os.path.splitext(filename)[1].lower()

        if ext == ".csv":
            f = open(filename)
            ret_df = pd.read_csv(f)
        elif ext in [".xls", ".xlsx"]:
            xls_file1 = pd.ExcelFile(filename)
            ret_df = xls_file1.parse(sheetname, header=header_index)

    elif connect_info['pluginID'] == '{a990a7fb-da08-47fb-b9f2-edd565bfeaf7}':
        # SQLite数据库
        db_file = connect_info['file']
        con = sqlite3.connect(db_file)
        con.execute("PRAGMA KEY = 'z1q1y6k8j7'")  # 数据库密钥
        str_sql = f'select * from `{sheetname}`'
        ret_df = pd.read_sql(str_sql, con)
        con.close()

    elif connect_info['pluginID'] == '{ae418aa8-2359-40b1-bf1e-0d1e36980256}':
        # MySQL数据库
        host = connect_info['file']
        user = connect_info['strUser']
        pw = connect_info['strPw']
        port = int(connect_info['strEncryptKey'])
        db_name = connect_info['baseFileName']

        conn = pymysql.connect(
            host=host, user=user, passwd=pw,
            db=db_name, port=port, charset="utf8"
        )
        str_sql = f'select * from `{sheetname}`'
        ret_df = pd.read_sql_query(str_sql, con=conn)

    return ret_df
```

### 7.2 数据回写函数

```python
def save_data(data, data_interface, filename, sheetname):
    """
    将处理后的数据回写到数据接口
    """
    data.fillna('', inplace=True)
    data = data.reset_index(drop=True)
    titles = list(data_interface.getTitles(filename, sheetname))
    dir_titles = data.columns.tolist()
    start_row = data_interface.getTitleIndex(filename, sheetname) + 1
    irow = data.shape[0]

    for t in dir_titles:
        icol = -1
        if t in titles:
            icol = titles.index(t)
        else:
            # 创建新列
            data_interface.createColumn(t)
            titles.append(t)
            icol = len(titles) - 1

        i = 0
        while i < irow:
            content = data.loc[i, t]
            data_interface.setContent(filename, sheetname, icol, i + start_row, str(content))
            i = i + 1

def save_column_data(data, data_interface, filename, sheetname, icol):
    """
    将单列数据回写
    """
    data.fillna('', inplace=True)
    irow = len(data)
    start_row = data_interface.getTitleIndex(filename, sheetname) + 1

    for i in range(irow):
        content = data[i]
        data_interface.setContent(filename, sheetname, icol, i + start_row, str(content))
```

---

## 八、平台模板结构

### 8.1 模板JSON结构

```json
{
    "platforms": [
        {
            "name": "平台名称",
            "formats": [
                {
                    "MD5": "列头MD5校验值",
                    "name": "数据表名",
                    "templateId": "{UUID}",
                    "version": "1.0",
                    "titles": ["原始列名1", "原始列名2", ...],
                    "mapping": {
                        "标准字段名": "原始列名",
                        "交易时间": "交易日期",
                        "交易金额": "发生额",
                        "借贷标志": "借贷方向"
                    },
                    "purerContent": "清洗规则XML",
                    "columnContentChecker": []
                }
            ]
        }
    ]
}
```

### 8.2 清洗规则XML示例

```xml
<?xml version="1.0"?>
<root>
    <version>2.0</version>

    <!-- 借贷标志转换 -->
    <Column Index="9" colname="借贷标志">
        <PurerReg regtype="ePureRegFindAndReplace">
            <RegParam name="REPLACE_STRING">进</RegParam>
            <RegParam name="MATCH_STRING">收入</RegParam>
        </PurerReg>
        <PurerReg regtype="ePureRegFindAndReplace">
            <RegParam name="REPLACE_STRING">出</RegParam>
            <RegParam name="MATCH_STRING">支出</RegParam>
        </PurerReg>
    </Column>

    <!-- 时间格式转换 -->
    <Column Index="5" colname="交易时间">
        <PurerReg regtype="ePureRegDateTime">
            <RegParam name="DATETIME_FORMAT">yyyyMMddhhmmss</RegParam>
            <RegParam name="DATETIME_TYPE">日期时间</RegParam>
        </PurerReg>
    </Column>
</root>
```

---

## 九、常用SQL查询模板

### 9.1 资金追踪查询

```sql
-- 查询指定账户的所有交易
SELECT 查询卡号, 客户名称, 交易对方卡号, 交易对方名称,
       交易时间, 交易金额, 借贷标志, 交易类型, 交易摘要
FROM 银行交易流水
WHERE 查询卡号 = '6222********1234'
ORDER BY 交易时间;

-- 查询大额交易
SELECT * FROM 银行交易流水
WHERE 交易金额 > 100000
ORDER BY 交易金额 DESC;

-- 查询快进快出（同一天内有进有出）
SELECT 查询卡号, 交易日期,
       SUM(CASE WHEN 借贷标志='进' THEN 交易金额 ELSE 0 END) as 收入,
       SUM(CASE WHEN 借贷标志='出' THEN 交易金额 ELSE 0 END) as 支出
FROM 银行交易流水
GROUP BY 查询卡号, 交易日期
HAVING 收入 > 0 AND 支出 > 0;
```

### 9.2 关联分析查询

```sql
-- 查询共同交易对方
SELECT 交易对方卡号, 交易对方名称, COUNT(DISTINCT 查询卡号) as 关联账户数
FROM 银行交易流水
WHERE 查询卡号 IN ('卡号1', '卡号2', '卡号3')
GROUP BY 交易对方卡号, 交易对方名称
HAVING 关联账户数 > 1
ORDER BY 关联账户数 DESC;

-- 查询资金流向路径
SELECT A.查询卡号 as 出账账户,
       A.交易对方卡号 as 入账账户,
       A.交易金额,
       A.交易时间
FROM 银行交易流水 A
WHERE A.借贷标志 = '出'
  AND EXISTS (
      SELECT 1 FROM 银行交易流水 B
      WHERE B.查询卡号 = A.交易对方卡号
        AND B.借贷标志 = '出'
  );
```

---

## 十、工具函数库

```python
# hyjj.utilities 模块常用方法

import hyjj.utilities as method

# 数据库连接
conn = method.openDbConnector()       # 打开数据库连接
method.closeDbConnector(conn)         # 关闭数据库连接

# 图表展示
method.display2Chart(战法名, 图表模板, 表名, rowIds)      # 展示到指定图表
method.display2ActiveChart(图表模板, 表名, rowIds)       # 展示到当前图表
method.display2NewChart(战法名, 图表模板, 表名, rowIds)   # 展示到新图表
```

---

*本文档为经侦分析技能的配套代码参考，请与 SKILL.md 配合使用。*
