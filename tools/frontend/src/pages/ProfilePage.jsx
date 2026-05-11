import React, { useEffect, useRef, useState } from "react";
import { Button, Card, Col, Collapse, InputNumber, Row, Select, Space, Table, Tag, Typography, message } from "antd";
import { api } from "@/api/client";
import GraphView from "@/components/GraphView";

const GANG_COLORS = ["#2b7cff", "#f5222d", "#fa8c16", "#52c41a", "#722ed1", "#13c2c2", "#eb2f96", "#faad14"];

function formatAmount(val) {
  if (val == null) return "0";
  if (Math.abs(val) >= 10000) {
    return (val / 10000).toFixed(2) + "万";
  }
  return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

const roleTagColor = { leader: "red", core: "orange", periphery: "blue" };
const roleLabel = { leader: "主犯", core: "骨干", periphery: "外围" };

export default function ProfilePage({ onBack, onComplete }) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [gangFilter, setGangFilter] = useState("all");
  const [entryValue, setEntryValue] = useState(undefined);
  const [entryOptions, setEntryOptions] = useState([]);
  const [loadingEntryOptions, setLoadingEntryOptions] = useState(false);
  const [minPairCount, setMinPairCount] = useState(50);
  const searchTimer = useRef(null);

  const fetchEntryOptions = async (q = "") => {
    setLoadingEntryOptions(true);
    try {
      const res = await api.penetrationOptions("entity", q);
      const options = (res.options || []).map((v) => ({ label: v, value: v }));
      setEntryOptions(options);
    } catch (err) {
      setEntryOptions([]);
      if (q) {
        message.error(err.message);
      }
    } finally {
      setLoadingEntryOptions(false);
    }
  };

  useEffect(() => {
    fetchEntryOptions("");
    return () => {
      if (searchTimer.current) {
        clearTimeout(searchTimer.current);
      }
    };
  }, []);

  const onSearchEntry = (q) => {
    if (searchTimer.current) {
      clearTimeout(searchTimer.current);
    }
    searchTimer.current = setTimeout(() => {
      fetchEntryOptions(q);
    }, 280);
  };

  const run = async () => {
    try {
      setRunning(true);
      const payload = {
        minEdgeAmount: 0,
        minPairCount: minPairCount || 50,
        entryType: "entity",
        entryValue: entryValue || "",
      };
      const res = await api.runProfile(payload);
      setResult(res);
      setGangFilter("all");
      onComplete?.("profile", { taskId: res.taskId });
      message.success("团伙画像分析完成");
    } catch (err) {
      message.error(err.message);
    } finally {
      setRunning(false);
    }
  };

  // filter graph by gang
  const filteredGraph = result?.graph
    ? (() => {
        if (gangFilter === "all") return result.graph;
        const gid = parseInt(gangFilter, 10);
        const nodes = (result.graph.nodes || []).filter((n) => n.gangId === gid || n.gangId === 0);
        const nodeIds = new Set(nodes.map((n) => n.id));
        const links = (result.graph.links || []).filter(
          (l) => nodeIds.has(l.source) && nodeIds.has(l.target)
        );
        return { nodes, links };
      })()
    : null;

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Card
        title="团伙画像"
        extra={
          <Space>
            <Button onClick={onBack}>返回首页</Button>
            <Button type="primary" loading={running} onClick={run}>
              开始画像分析
            </Button>
          </Space>
        }
      >
        <Typography.Paragraph type="secondary">
          从已入库交易自动分析组织结构、角色分工、关键节点与行为特征。团伙识别优先依据共享IP/MAC；当缺少设备证据时，按双方交易频次（至少{minPairCount || 50}笔）判定并展示关系。
        </Typography.Paragraph>
        <Space wrap>
          <Typography.Text type="secondary">线索值（筛选用户）</Typography.Text>
          <Select
            showSearch
            allowClear
            style={{ width: 360 }}
            value={entryValue}
            placeholder="输入关键词选择用户，不选则全量分析"
            options={entryOptions}
            loading={loadingEntryOptions}
            filterOption={false}
            onSearch={onSearchEntry}
            onChange={setEntryValue}
            notFoundContent={loadingEntryOptions ? "加载中..." : "暂无候选，请先清洗数据"}
          />
          <Typography.Text type="secondary" style={{ marginLeft: 16 }}>交易频次阈值</Typography.Text>
          <InputNumber
            min={1}
            value={minPairCount}
            onChange={(v) => setMinPairCount(v)}
            style={{ width: 120 }}
            placeholder="50"
          />
        </Space>
      </Card>

      {result && (
        <>
          <Row gutter={16}>
            <Col span={12}>
              <Card title="团伙概览" extra={<Tag color="blue">共 {result.gangCount || 0} 个团伙</Tag>}>
                {(result.gangs || []).length > 0 ? (
                  <Collapse
                    items={(result.gangs || []).map((g) => ({
                      key: g.gangId,
                      label: (
                        <Space>
                          <Tag color={GANG_COLORS[(g.gangId - 1) % GANG_COLORS.length]}>
                            {g.label}
                          </Tag>
                          <span>{g.size} 个主体</span>
                          <span style={{ color: "#999" }}>
                            涉及金额 {formatAmount(g.totalAmount)}
                          </span>
                        </Space>
                      ),
                      children: (
                        <Space direction="vertical" style={{ width: "100%" }}>
                          <div>
                            <Tag color="red">主犯</Tag> {g.leader}
                          </div>
                          {g.coreMembers?.length > 0 && (
                            <div>
                              <Tag color="orange">骨干 ({g.coreMembers.length})</Tag>{" "}
                              {g.coreMembers.join("、")}
                            </div>
                          )}
                          {g.periphery?.length > 0 && (
                            <div>
                              <Tag color="blue">外围 ({g.periphery.length})</Tag>{" "}
                              {g.periphery.slice(0, 5).join("、")}
                              {g.periphery.length > 5 && ` 等${g.periphery.length}家`}
                            </div>
                          )}
                          {g.evidenceSummary?.length > 0 && (
                            <div>
                              <Tag color="geekblue">团伙证据</Tag> {g.evidenceSummary.join("；")}
                            </div>
                          )}
                        </Space>
                      ),
                    }))}
                  />
                ) : (
                  <Typography.Paragraph type="secondary">
                    未识别到可由共享设备或登记/账户人员证据支撑的明确团伙。
                  </Typography.Paragraph>
                )}
              </Card>
            </Col>
            <Col span={12}>
              <Card title="关键结论">
                <Typography.Paragraph>{result.organizationBrief}</Typography.Paragraph>
                <Typography.Paragraph type="secondary">任务ID: {result.taskId}</Typography.Paragraph>
              </Card>
            </Col>
          </Row>

          <Card title="关键节点">
            <Table
              rowKey="id"
              pagination={false}
              dataSource={result.keyNodes || []}
              scroll={{ x: 800 }}
              columns={[
                {
                  title: "团伙",
                  dataIndex: "gangId",
                  width: 80,
                  render: (v) =>
                    v > 0 ? (
                      <Tag color={GANG_COLORS[(v - 1) % GANG_COLORS.length]}>
                        团伙{v}
                      </Tag>
                    ) : (
                      "-"
                    ),
                },
                { title: "主体", dataIndex: "label" },
                { title: "角色", dataIndex: "role", width: 80,
                  render: (v) => v ? <Tag color={roleTagColor[v]}>{roleLabel[v] || v}</Tag> : "-",
                },
                { title: "度数", dataIndex: "degree", width: 80 },
                {
                  title: "介数",
                  dataIndex: "betweenness",
                  width: 100,
                  render: (v) => v ? v.toFixed(1) : "-",
                },
                { title: "流入", dataIndex: "totalIn", width: 120, render: (v) => formatAmount(v) },
                { title: "流出", dataIndex: "totalOut", width: 120, render: (v) => formatAmount(v) },
              ]}
            />
          </Card>

          <Card title="高频联系">
            <Table
              rowKey={(r) => `${r.source}_${r.target}`}
              pagination={false}
              dataSource={result.frequentContacts || []}
              columns={[
                { title: "来源", dataIndex: "source" },
                { title: "去向", dataIndex: "target" },
                { title: "笔数", dataIndex: "count", width: 100 },
                { title: "金额", dataIndex: "amount", width: 140, render: (v) => formatAmount(v) },
              ]}
            />
          </Card>

          <Card
            title="画像关系图"
            extra={
              result.gangCount > 1 && (
                <Space>
                  <Tag
                    style={{ cursor: "pointer" }}
                    color={gangFilter === "all" ? "blue" : "default"}
                    onClick={() => setGangFilter("all")}
                  >
                    全部
                  </Tag>
                  {(result.gangs || []).map((g) => (
                    <Tag
                      key={g.gangId}
                      style={{ cursor: "pointer" }}
                      color={gangFilter === String(g.gangId) ? GANG_COLORS[(g.gangId - 1) % GANG_COLORS.length] : "default"}
                      onClick={() => setGangFilter(String(g.gangId))}
                    >
                      {g.label}
                    </Tag>
                  ))}
                </Space>
              )
            }
          >
            <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
              该图仅展示交易频次至少50笔的关系；团伙颜色与筛选来自共享IP/MAC与高频交易规则。
            </Typography.Paragraph>
            <GraphView graph={filteredGraph} title="团伙画像网络图" layout="force" />
          </Card>
        </>
      )}
    </Space>
  );
}
