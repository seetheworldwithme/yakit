import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Card,
  Col,
  DatePicker,
  Form,
  InputNumber,
  Radio,
  Row,
  Segmented,
  Select,
  Slider,
  Space,
  Statistic,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import { api } from "@/api/client";
import PenetrationFlowGraph from "@/components/PenetrationFlowGraph";
import {
  deriveDisplayGraph,
  formatAmount,
  summarizeNodeRelations,
} from "@/components/penetrationGraphModel";
import "@/pages/PenetrationPage.css";

const { RangePicker } = DatePicker;

function topNodeID(displayGraph) {
  const nodes = Array.isArray(displayGraph?.nodes) ? displayGraph.nodes : [];
  if (nodes.length === 0) return "";
  const roots = nodes.filter((node) => Number(node.depth) === 0);
  const pool = roots.length > 0 ? roots : nodes;
  const sorted = pool.slice().sort((a, b) => {
    const af = Number(a.totalIn || 0) + Number(a.totalOut || 0);
    const bf = Number(b.totalIn || 0) + Number(b.totalOut || 0);
    if (af !== bf) return bf - af;
    return Number(b.degree || 0) - Number(a.degree || 0);
  });
  return String(sorted[0]?.id || "");
}

function edgeDirectionType(edge) {
  if (!edge) return "正常";
  return edge.isBackflow ? "回环/回流" : "正常";
}

export default function PenetrationPage({ onBack, onComplete, lastCleanTaskId }) {
  const [form] = Form.useForm();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [entryOptions, setEntryOptions] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const optionSearchTimer = useRef(null);

  const [displayMinEdgeAmount, setDisplayMinEdgeAmount] = useState(0);
  const [displayMaxEdgesPerNode, setDisplayMaxEdgesPerNode] = useState(6);
  const [displayBackflowOnly, setDisplayBackflowOnly] = useState(false);
  const [focusNodeID, setFocusNodeID] = useState("");
  const [displayFocusMode, setDisplayFocusMode] = useState(true);
  const [displayFocusNeighborLimit, setDisplayFocusNeighborLimit] = useState(8);
  const [fullscreenOpen, setFullscreenOpen] = useState(false);
  const [fullscreenGraphHeight, setFullscreenGraphHeight] = useState(760);

  const fetchOptions = async (entryType, q = "") => {
    setLoadingOptions(true);
    try {
      const res = await api.penetrationOptions(entryType, q);
      setEntryOptions((res.options || []).map((v) => ({ label: v, value: v })));
    } catch (err) {
      setEntryOptions([]);
      if (q) {
        message.error(err.message);
      }
    } finally {
      setLoadingOptions(false);
    }
  };

  useEffect(() => {
    fetchOptions(form.getFieldValue("entryType") || "entity", "");
    return () => {
      if (optionSearchTimer.current) {
        clearTimeout(optionSearchTimer.current);
      }
    };
  }, [form]);

  const onEntryTypeChange = (entryType) => {
    form.setFieldValue("entryValue", undefined);
    fetchOptions(entryType, "");
  };

  const onSearchEntry = (q) => {
    const entryType = form.getFieldValue("entryType") || "entity";
    if (optionSearchTimer.current) {
      clearTimeout(optionSearchTimer.current);
    }
    optionSearchTimer.current = setTimeout(() => {
      fetchOptions(entryType, q);
    }, 280);
  };

  const run = async () => {
    try {
      const values = await form.validateFields();
      setRunning(true);
      const dateRange = values.dateRange || [];
      const payload = {
        entryType: values.entryType,
        entryValue: values.entryValue,
        direction: values.direction || "outbound",
        maxHops: Number(values.maxHops || 4),
        minAmount: Number(values.minAmount || 0),
        startDate: dateRange[0] ? dateRange[0].format("YYYY-MM-DD") : "",
        endDate: dateRange[1] ? dateRange[1].format("YYYY-MM-DD") : "",
      };
      const keyMode = values.keyMode !== false;
      if (keyMode) {
        payload.branchLimit = payload.direction === "both" ? 6 : 12;
        payload.nodeLimit = 1200;
        payload.edgeLimit = 2200;
      } else {
        payload.branchLimit = payload.direction === "both" ? 16 : 28;
        payload.nodeLimit = 6000;
        payload.edgeLimit = 12000;
      }
      const res = await api.runPenetration(payload);
      setResult(res);
      setDisplayMinEdgeAmount(0);
      setDisplayMaxEdgesPerNode(6);
      setDisplayBackflowOnly(false);
      setDisplayFocusMode(true);
      setDisplayFocusNeighborLimit(8);
      setFocusNodeID("");
      onComplete?.("penetration", { taskId: res.taskId });
      message.success("资金穿透分析完成");
    } catch (err) {
      if (err?.message) {
        message.error(err.message);
      }
    } finally {
      setRunning(false);
    }
  };

  const displayGraph = useMemo(
    () =>
      deriveDisplayGraph(result?.graph, {
        minEdgeAmount: displayMinEdgeAmount,
        maxEdgesPerNode: displayMaxEdgesPerNode,
        backflowOnly: displayBackflowOnly,
        focusNodeID,
        focusMode: displayFocusMode,
        focusNeighborLimit: displayFocusNeighborLimit,
        maxNodes: displayFocusMode ? 420 : 1400,
        maxEdges: displayFocusMode ? 860 : 2200,
      }),
    [
      result,
      displayMinEdgeAmount,
      displayMaxEdgesPerNode,
      displayBackflowOnly,
      focusNodeID,
      displayFocusMode,
      displayFocusNeighborLimit,
    ]
  );

  useEffect(() => {
    if (!displayGraph?.nodes?.length) {
      setFocusNodeID("");
      return;
    }
    const stillExists = displayGraph.nodes.some((node) => String(node.id) === String(focusNodeID));
    if (!focusNodeID || !stillExists) {
      setFocusNodeID(topNodeID(displayGraph));
    }
  }, [displayGraph, focusNodeID]);

  const focusNode = useMemo(() => {
    const nodes = Array.isArray(displayGraph?.nodes) ? displayGraph.nodes : [];
    return nodes.find((node) => String(node.id) === String(focusNodeID)) || null;
  }, [displayGraph, focusNodeID]);

  const relationBuckets = useMemo(
    () => summarizeNodeRelations(displayGraph, focusNodeID),
    [displayGraph, focusNodeID]
  );

  const relationRows = useMemo(() => {
    const merge = [];
    for (const edge of relationBuckets.inbound) {
      merge.push({ ...edge, directionBucket: "直接流入" });
    }
    for (const edge of relationBuckets.outbound) {
      merge.push({ ...edge, directionBucket: "直接流出" });
    }
    for (const edge of relationBuckets.backflow) {
      merge.push({ ...edge, directionBucket: "回环/回流" });
    }
    return merge;
  }, [relationBuckets]);

  const summaryStats = useMemo(() => {
    const links = Array.isArray(result?.graph?.links) ? result.graph.links : [];
    const totalAmount = links.reduce((sum, edge) => sum + Number(edge.value || 0), 0);
    const backflowCount = links.filter((edge) => edge.isBackflow).length;
    return {
      nodes: Number(result?.nodeSize || 0),
      edges: Number(result?.edgeSize || 0),
      backflowCount,
      totalAmount,
    };
  }, [result]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const prevOverflow = document.body.style.overflow;
    if (fullscreenOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = prevOverflow || "";
    }
    return () => {
      document.body.style.overflow = prevOverflow || "";
    };
  }, [fullscreenOpen]);

  useEffect(() => {
    const syncHeight = () => {
      if (typeof window === "undefined") return;
      setFullscreenGraphHeight(Math.max(540, window.innerHeight - 118));
    };
    syncHeight();
    window.addEventListener("resize", syncHeight);
    return () => window.removeEventListener("resize", syncHeight);
  }, []);

  return (
    <Space direction="vertical" style={{ width: "100%" }} size={16}>
      <Card className="penetration-hero-card">
        <div className="penetration-hero-title">资金穿透分析台</div>
        <Typography.Paragraph className="penetration-hero-subtitle">
          以可控穿透方向和层级展开资金网络，自动标记回环风险并支持聚焦查看关键流入/流出关系。最近清洗任务:
          <Tag color={lastCleanTaskId ? "blue" : "default"} style={{ marginInlineStart: 8 }}>
            {lastCleanTaskId || "无"}
          </Tag>
        </Typography.Paragraph>
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            entryType: "entity",
            direction: "outbound",
            maxHops: 4,
            minAmount: 0,
            keyMode: true,
          }}
        >
          <Row gutter={16}>
            <Col xs={24} md={6}>
              <Form.Item label="线索类型" name="entryType">
                <Radio.Group
                  onChange={(e) => onEntryTypeChange(e.target.value)}
                  options={[
                    { label: "主体", value: "entity" },
                    { label: "票据/流水号", value: "invoice" },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                label="线索值"
                name="entryValue"
                rules={[{ required: true, message: "请选择线索值" }]}
              >
                <Select
                  showSearch
                  allowClear
                  placeholder="输入关键词选择线索"
                  options={entryOptions}
                  loading={loadingOptions}
                  filterOption={false}
                  onSearch={onSearchEntry}
                  notFoundContent={loadingOptions ? "加载中..." : "暂无候选，请先清洗数据"}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={5}>
              <Form.Item label="穿透方向" name="direction">
                <Segmented
                  block
                  options={[
                    { label: "下游", value: "outbound" },
                    { label: "上游", value: "inbound" },
                    { label: "双向", value: "both" },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={5}>
              <Form.Item label="最小入库金额" name="minAmount">
                <InputNumber
                  min={0}
                  step={1000}
                  style={{ width: "100%" }}
                  addonAfter="元"
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item label="穿透层级" name="maxHops">
                <Slider min={1} max={6} marks={{ 1: "1", 3: "3", 6: "6" }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item label="交易日期范围（可选）" name="dateRange">
                <RangePicker style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item label="服务端关键裁剪模式" name="keyMode" valuePropName="checked">
                <Switch checkedChildren="关键模式" unCheckedChildren="全量模式" />
              </Form.Item>
            </Col>
          </Row>

          <Space>
            <Button type="primary" loading={running} onClick={run}>
              开始穿透分析
            </Button>
            <Button onClick={onBack}>返回首页</Button>
          </Space>
        </Form>
      </Card>

      {result && (
        <>
          <Row gutter={16}>
            <Col xs={12} md={6}>
              <Card className="penetration-stat-card">
                <Statistic title="主体节点" value={summaryStats.nodes} />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card className="penetration-stat-card">
                <Statistic title="资金边" value={summaryStats.edges} />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card className="penetration-stat-card">
                <Statistic title="回环边" value={summaryStats.backflowCount} valueStyle={{ color: "#cf1322" }} />
              </Card>
            </Col>
            <Col xs={12} md={6}>
              <Card className="penetration-stat-card">
                <Statistic title="覆盖资金量" value={formatAmount(summaryStats.totalAmount)} />
              </Card>
            </Col>
          </Row>

          <Card
            className="penetration-filter-card"
            title="图谱可视化筛选"
            extra={
              <Space>
                {result?.truncated && result?.trimNote ? (
                  <Tag color="gold">{result.trimNote}</Tag>
                ) : null}
                <Tag color="processing">任务ID: {result.taskId}</Tag>
              </Space>
            }
          >
            <Row gutter={18}>
              <Col xs={24} md={8}>
                <Typography.Text strong>图上最小金额</Typography.Text>
                <InputNumber
                  min={0}
                  step={1000}
                  value={displayMinEdgeAmount}
                  style={{ width: "100%", marginTop: 8 }}
                  addonAfter="元"
                  onChange={(v) => setDisplayMinEdgeAmount(Number(v || 0))}
                />
              </Col>
              <Col xs={24} md={8}>
                <Typography.Text strong>每个节点最多展示出边</Typography.Text>
                <Slider
                  min={1}
                  max={12}
                  value={displayMaxEdgesPerNode}
                  style={{ marginTop: 8 }}
                  onChange={setDisplayMaxEdgesPerNode}
                />
              </Col>
              <Col xs={24} md={8}>
                <Typography.Text strong>仅看回环/回流</Typography.Text>
                <div style={{ marginTop: 12 }}>
                  <Switch
                    checked={displayBackflowOnly}
                    checkedChildren="仅回环"
                    unCheckedChildren="全部"
                    onChange={setDisplayBackflowOnly}
                  />
                </div>
              </Col>
            </Row>
            <Row gutter={18} style={{ marginTop: 8 }}>
              <Col xs={24} md={8}>
                <Typography.Text strong>展示模式</Typography.Text>
                <div style={{ marginTop: 12 }}>
                  <Switch
                    checked={displayFocusMode}
                    checkedChildren="聚焦模式"
                    unCheckedChildren="全图模式"
                    onChange={setDisplayFocusMode}
                  />
                </div>
              </Col>
              <Col xs={24} md={16}>
                <Typography.Text strong>聚焦模式邻居数量</Typography.Text>
                <Slider
                  min={4}
                  max={16}
                  value={displayFocusNeighborLimit}
                  style={{ marginTop: 8 }}
                  onChange={setDisplayFocusNeighborLimit}
                />
              </Col>
            </Row>
          </Card>

          <Row gutter={16}>
            <Col xs={24} xl={17}>
              <Card
                title="资金穿透图"
                className="penetration-graph-card"
                extra={
                  <Space size={10}>
                    <Tag color="green">正常流向</Tag>
                    <Tag color="red">回环/回流</Tag>
                    <Button size="small" onClick={() => setFullscreenOpen(true)}>
                      全屏查看
                    </Button>
                  </Space>
                }
              >
                {!fullscreenOpen ? (
                  <PenetrationFlowGraph
                    graph={displayGraph}
                    focusNodeID={focusNodeID}
                    onFocusNodeChange={setFocusNodeID}
                    height={780}
                    showEdgeLabels={false}
                  />
                ) : (
                  <div className="penetration-fullscreen-tip">
                    已切换到全屏视图，请在全屏层查看图谱。
                  </div>
                )}
              </Card>
            </Col>
            <Col xs={24} xl={7}>
              <Card title="当前聚焦主体" className="penetration-panel-card">
                {focusNode ? (
                  <Space direction="vertical" style={{ width: "100%" }} size={8}>
                    <Typography.Text className="focus-node-name">{focusNode.label || focusNode.id}</Typography.Text>
                    <Typography.Text type="secondary">层级 L{Number(focusNode.depth ?? -1)}</Typography.Text>
                    <Typography.Text>流入: {formatAmount(focusNode.totalIn || 0)}</Typography.Text>
                    <Typography.Text>流出: {formatAmount(focusNode.totalOut || 0)}</Typography.Text>
                    <Typography.Text>连通度: {Number(focusNode.degree || 0)}</Typography.Text>
                  </Space>
                ) : (
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    点击图中的节点查看它的流入/流出关系。
                  </Typography.Paragraph>
                )}
              </Card>

              <Card title="关系明细" className="penetration-panel-card" style={{ marginTop: 16 }}>
                <Table
                  size="small"
                  rowKey={(row) =>
                    `${row.source}_${row.target}_${row.directionBucket}_${Number(row.value || 0)}_${Number(row.count || 0)}`
                  }
                  dataSource={relationRows}
                  pagination={{ pageSize: 8, showSizeChanger: false }}
                  scroll={{ x: 600 }}
                  columns={[
                    {
                      title: "分类",
                      dataIndex: "directionBucket",
                      width: 92,
                      render: (v) => {
                        if (v === "回环/回流") return <Tag color="red">{v}</Tag>;
                        if (v === "直接流出") return <Tag color="green">{v}</Tag>;
                        return <Tag color="blue">{v}</Tag>;
                      },
                    },
                    { title: "来源", dataIndex: "source", width: 110, ellipsis: true },
                    { title: "去向", dataIndex: "target", width: 110, ellipsis: true },
                    {
                      title: "方向类型",
                      width: 90,
                      render: (_, row) => edgeDirectionType(row),
                    },
                    {
                      title: "金额",
                      dataIndex: "value",
                      width: 110,
                      render: (v) => formatAmount(v),
                    },
                    { title: "笔数", dataIndex: "count", width: 70 },
                  ]}
                />
              </Card>
            </Col>
          </Row>
        </>
      )}

      {fullscreenOpen && (
        <div className="penetration-fullscreen-shell">
          <div className="penetration-fullscreen-toolbar">
            <Space>
              <Typography.Text strong style={{ fontSize: 16 }}>
                资金穿透全屏视图
              </Typography.Text>
              <Tag color="green">正常流向</Tag>
              <Tag color="red">回环/回流</Tag>
            </Space>
            <Space>
              <Button onClick={() => setFullscreenOpen(false)}>退出全屏</Button>
            </Space>
          </div>
          <div className="penetration-fullscreen-content">
            <div className="penetration-fullscreen-graph">
              <PenetrationFlowGraph
                graph={displayGraph}
                focusNodeID={focusNodeID}
                onFocusNodeChange={setFocusNodeID}
                height={fullscreenGraphHeight}
                showEdgeLabels={false}
              />
            </div>
            <div className="penetration-fullscreen-side">
              <Card title="当前聚焦主体" className="penetration-panel-card">
                {focusNode ? (
                  <Space direction="vertical" style={{ width: "100%" }} size={8}>
                    <Typography.Text className="focus-node-name">{focusNode.label || focusNode.id}</Typography.Text>
                    <Typography.Text type="secondary">层级 L{Number(focusNode.depth ?? -1)}</Typography.Text>
                    <Typography.Text>流入: {formatAmount(focusNode.totalIn || 0)}</Typography.Text>
                    <Typography.Text>流出: {formatAmount(focusNode.totalOut || 0)}</Typography.Text>
                    <Typography.Text>连通度: {Number(focusNode.degree || 0)}</Typography.Text>
                  </Space>
                ) : (
                  <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
                    点击图中的节点查看它的流入/流出关系。
                  </Typography.Paragraph>
                )}
              </Card>
              <Card title="关系明细" className="penetration-panel-card" style={{ marginTop: 14 }}>
                <Table
                  size="small"
                  rowKey={(row) =>
                    `${row.source}_${row.target}_${row.directionBucket}_${Number(row.value || 0)}_${Number(row.count || 0)}`
                  }
                  dataSource={relationRows}
                  pagination={{ pageSize: 10, showSizeChanger: false }}
                  scroll={{ y: Math.max(300, fullscreenGraphHeight - 260), x: 620 }}
                  columns={[
                    {
                      title: "分类",
                      dataIndex: "directionBucket",
                      width: 92,
                      render: (v) => {
                        if (v === "回环/回流") return <Tag color="red">{v}</Tag>;
                        if (v === "直接流出") return <Tag color="green">{v}</Tag>;
                        return <Tag color="blue">{v}</Tag>;
                      },
                    },
                    { title: "来源", dataIndex: "source", width: 110, ellipsis: true },
                    { title: "去向", dataIndex: "target", width: 110, ellipsis: true },
                    { title: "金额", dataIndex: "value", width: 100, render: (v) => formatAmount(v) },
                    { title: "笔数", dataIndex: "count", width: 70 },
                  ]}
                />
              </Card>
            </div>
          </div>
        </div>
      )}
    </Space>
  );
}
