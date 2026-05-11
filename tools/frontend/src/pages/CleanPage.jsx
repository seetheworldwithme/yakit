import React, { useMemo, useRef, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  List,
  Progress,
  Row,
  Space,
  Table,
  Typography,
  Upload,
  message,
} from "antd";
import { InboxOutlined } from "@ant-design/icons";
import { api } from "@/api/client";

const { Dragger } = Upload;

export default function CleanPage({ onBack, onComplete }) {
  const fileInputRef = useRef(null);
  const [paths, setPaths] = useState([]);
  const [pendingUploadFiles, setPendingUploadFiles] = useState([]);
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState([]);
  const [result, setResult] = useState(null);

  const appendLog = (line) => {
    const stamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, `[${stamp}] ${line}`].slice(-120));
  };

  const addPendingUploadFiles = (files) => {
    const validFiles = (files || []).filter((f) => !!f);
    if (!validFiles.length) {
      return;
    }
    setPendingUploadFiles((prev) => {
      const map = new Map();
      [...(prev || []), ...validFiles].forEach((f) => {
        const key = `${f.name}_${f.size}_${f.lastModified || 0}`;
        if (!map.has(key)) {
          map.set(key, f);
        }
      });
      return Array.from(map.values());
    });
  };

  const resolvePathsBeforeAction = async () => {
    let merged = [...(paths || [])];
    if (!pendingUploadFiles.length) {
      return merged;
    }

    appendLog(`开始上传 ${pendingUploadFiles.length} 个文件到后端临时目录`);
    try {
      const uploadResp = await api.cleanUpload(pendingUploadFiles);
      merged = Array.from(new Set([...(merged || []), ...(uploadResp.paths || [])]));
      appendLog(`上传完成，生成 ${uploadResp.count || 0} 个临时文件路径`);
    } catch (err) {
      appendLog(`上传接口失败: ${err.message}`);
      throw new Error(`${err.message}`);
    }

    if (!merged.length) {
      throw new Error("未获得可用文件路径，请重新选择文件。");
    }
    setPaths(merged);
    setPendingUploadFiles([]);
    return merged;
  };

  const pickFiles = () => {
    fileInputRef.current?.click();
  };

  const runPreview = async () => {
    if (!paths.length && !pendingUploadFiles.length) {
      message.warning("请先选择或拖入文件");
      return;
    }
    setLoadingPreview(true);
    try {
      appendLog("开始预检前检查后端健康状态");
      await api.health();
      const mergedPaths = await resolvePathsBeforeAction();
      appendLog(`开始预检，文件数: ${mergedPaths.length}`);
      const res = await api.cleanPreview(mergedPaths);
      setPreview(res);
      appendLog(`预检完成，总记录数: ${res.totalRows || 0}`);
      message.success("预检完成");
    } catch (err) {
      appendLog(`预检失败: ${err.message}`);
      message.error(err.message);
    } finally {
      setLoadingPreview(false);
    }
  };

  const runClean = async () => {
    if (!paths.length && !pendingUploadFiles.length) {
      message.warning("请先选择文件");
      return;
    }
    setRunning(true);
    setLogs([]);
    setProgress(0);
    setResult(null);
    try {
      appendLog("开始清洗前检查后端健康状态");
      await api.health();
      const mergedPaths = await resolvePathsBeforeAction();
      appendLog(`开始清洗任务，文件数: ${mergedPaths.length}`);
      const runResp = await api.cleanRun(mergedPaths);
      const taskId = runResp.taskId;
      const es = new EventSource(`${api.base}/clean/stream/${taskId}`);
      let settled = false;
      let polling = false;

      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

      const fetchResultWithRetry = async () => {
        if (polling) return;
        polling = true;
        appendLog("SSE 中断，尝试轮询任务结果");
        for (let i = 0; i < 8; i += 1) {
          try {
            const rs = await api.cleanResult(taskId);
            settled = true;
            setResult(rs);
            setRunning(false);
            onComplete?.("clean", { taskId, result: rs });
            appendLog(`清洗完成（轮询拿到结果），清洗后记录数: ${rs.afterRows || 0}`);
            message.success("数据清洗完成");
            return;
          } catch (_) {
            await sleep(500);
          }
        }
        setRunning(false);
        appendLog("轮询未获取到任务结果，请稍后重试");
        message.error("清洗任务状态未知，请重试或查看后端日志");
      };

      es.onmessage = async (evt) => {
        const data = JSON.parse(evt.data);
        setProgress(data.progress || 0);
        appendLog(`[${data.step}] ${data.message}`);
        if (data.status === "completed" && !settled) {
          settled = true;
          es.close();
          const rs = await api.cleanResult(taskId);
          setResult(rs);
          setRunning(false);
          onComplete?.("clean", { taskId, result: rs });
          appendLog(`清洗完成，清洗后记录数: ${rs.afterRows || 0}`);
          message.success("数据清洗完成");
        }
        if (data.status === "failed" && !settled) {
          settled = true;
          es.close();
          setRunning(false);
          appendLog("清洗任务失败，请查看后端错误");
          message.error("数据清洗失败");
        }
      };
      es.onerror = () => {
        if (settled) {
          return;
        }
        appendLog("SSE 连接异常中断");
        es.close();
        fetchResultWithRetry();
      };
    } catch (err) {
      setRunning(false);
      appendLog(`清洗启动失败: ${err.message}`);
      message.error(err.message);
    }
  };

  const previewColumns = useMemo(
    () => [
      { title: "文件", dataIndex: "path", width: 330, ellipsis: true },
      { title: "类型", dataIndex: "kind", width: 120 },
      { title: "行数", dataIndex: "rows", width: 120 },
      {
        title: "问题计数",
        dataIndex: "issues",
        render: (v) =>
          Object.keys(v || {}).length
            ? Object.entries(v || {})
                .map(([k, c]) => `${k}:${c}`)
                .join("；")
            : "无",
      },
    ],
    []
  );

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".xlsx,.xls,.csv"
        style={{ display: "none" }}
        onChange={(e) => {
          addPendingUploadFiles(Array.from(e.target.files || []));
          e.target.value = "";
        }}
      />
      <Card
        title="数据清洗"
        extra={
          <Space>
            <Button onClick={onBack}>返回首页</Button>
            <Button type="primary" onClick={pickFiles}>
              选择文件
            </Button>
          </Space>
        }
      >
        <Dragger
          multiple
          accept=".xlsx,.xls,.csv"
          onDrop={(event) => {
            const allFiles = Array.from(event?.dataTransfer?.files || []);
            if (allFiles.length) {
              addPendingUploadFiles(allFiles);
              appendLog(`拖拽接收文件 ${allFiles.length} 个，将在预检/清洗前自动上传`);
              message.info(`已接收 ${allFiles.length} 个拖拽文件，将在预检/清洗前自动上传。`);
            }
          }}
          beforeUpload={(file) => {
            addPendingUploadFiles([file]);
            appendLog(`添加待上传文件: ${file.name}`);
            return Upload.LIST_IGNORE;
          }}
          showUploadList={false}
          style={{ marginBottom: 14 }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">拖拽 xlsx/csv 到这里，或点击上方选择文件</p>
          <p className="ant-upload-hint">支持样例: 专票购方/专票销方/普票购方/纳税人信息/交易明细/人员信息/账户信息/子账户信息</p>
        </Dragger>
        <Space>
          <Button loading={loadingPreview} onClick={runPreview}>
            预检清洗
          </Button>
          <Button type="primary" loading={running} onClick={runClean}>
            执行清洗并导入 SQLite
          </Button>
        </Space>
      </Card>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="已选文件">
            <Space direction="vertical" style={{ width: "100%" }}>
              {pendingUploadFiles.length ? (
                <List
                  size="small"
                  dataSource={pendingUploadFiles.map((f) => `${f.name} (${(f.size / 1024).toFixed(1)} KB)`)}
                  renderItem={(item) => <List.Item>{item}</List.Item>}
                />
              ) : (
                <Typography.Text type="secondary">暂无文件，请选择或拖入</Typography.Text>
              )}
            </Space>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="任务进度">
            <Progress percent={progress} status={running ? "active" : "normal"} />
            <div className="log-box">
              {logs.map((l, i) => (
                <div key={`${l}_${i}`}>{l}</div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      {preview && (
        <Card title="预检结果">
          <Descriptions bordered column={2} size="small">
            <Descriptions.Item label="总记录数">{preview.totalRows}</Descriptions.Item>
            <Descriptions.Item label="识别字段数">
              {Object.keys(preview.fieldMappings || {}).length}
            </Descriptions.Item>
          </Descriptions>
          <Table
            rowKey="path"
            style={{ marginTop: 12 }}
            columns={previewColumns}
            dataSource={preview.files || []}
            pagination={false}
          />
        </Card>
      )}

      {result && (
        <Card
          title="清洗结果对比"
          extra={
            <Button type="primary" onClick={onBack}>
              下一步（返回首页）
            </Button>
          }
        >
          <Descriptions bordered column={3} size="small">
            <Descriptions.Item label="清洗前">{result.beforeRows}</Descriptions.Item>
            <Descriptions.Item label="清洗后">{result.afterRows}</Descriptions.Item>
            <Descriptions.Item label="空字段">{result.nullFields}</Descriptions.Item>
            <Descriptions.Item label="重复">{result.duplicates}</Descriptions.Item>
            <Descriptions.Item label="异常">{result.abnormalRows}</Descriptions.Item>
            <Descriptions.Item label="作废过滤">{result.skippedVoid}</Descriptions.Item>
          </Descriptions>
          {result.errors?.length > 0 && (
            <Alert
              style={{ marginTop: 12 }}
              type="warning"
              showIcon
              message="部分记录处理异常"
              description={result.errors.join(" | ")}
            />
          )}
        </Card>
      )}
    </Space>
  );
}
