import React, { useState } from "react";
import { Button, Card, Form, Input, Space, Typography, message } from "antd";
import { api } from "@/api/client";

export default function ReportPage({ onBack, latestPenetrationTaskId, latestProfileTaskId, onComplete }) {
  const [form] = Form.useForm();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);

  const run = async () => {
    try {
      const values = form.getFieldsValue();
      setRunning(true);
      const res = await api.generateReport({
        penetrationTaskId: values.penetrationTaskId || latestPenetrationTaskId || "",
        profileTaskId: values.profileTaskId || latestProfileTaskId || "",
      });
      setResult(res);
      onComplete?.("report", { taskId: res.taskId });
      message.success("报告生成成功");
    } catch (err) {
      message.error(err.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <Card
        title="一键报告"
        extra={
          <Space>
            <Button onClick={onBack}>返回首页</Button>
            <Button type="primary" loading={running} onClick={run}>
              生成 Word 报告
            </Button>
          </Space>
        }
      >
        <Typography.Paragraph type="secondary">
          固定模板自动汇总资金穿透结果，以及基于共享设备和登记/账户人员证据的团伙画像结果，生成 docx 报告。
        </Typography.Paragraph>
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            penetrationTaskId: latestPenetrationTaskId || "",
            profileTaskId: latestProfileTaskId || "",
          }}
        >
          <Form.Item label="穿透任务ID" name="penetrationTaskId">
            <Input placeholder="可留空，默认使用最近一次" />
          </Form.Item>
          <Form.Item label="画像任务ID" name="profileTaskId">
            <Input placeholder="可留空，默认使用最近一次" />
          </Form.Item>
        </Form>
      </Card>

      {result && (
        <Card title="报告结果">
          <Typography.Paragraph>任务ID: {result.taskId}</Typography.Paragraph>
          <Space>
            <a href={`${api.base}${result.downloadUrl}`} target="_blank" rel="noreferrer">
              <Button type="primary">下载报告</Button>
            </a>
          </Space>
        </Card>
      )}
    </Space>
  );
}
