import React from "react";
import { Button, Card, Col, Row, Tag, Typography } from "antd";
import { CheckCircleFilled, ClockCircleOutlined } from "@ant-design/icons";

const MODULES = [
  { key: "clean", name: "数据清洗", desc: "导入 xlsx/csv，清洗并写入 SQLite" },
  { key: "penetration", name: "资金穿透", desc: "按主体或票据/流水号多层追踪资金流向" },
  { key: "profile", name: "团伙画像", desc: "基于共享设备和登记人员证据识别团伙并展示交易关系" },
  { key: "report", name: "一键报告", desc: "汇总分析并生成 Word 报告" },
];

export default function HomePage({ statusMap, onOpenModule }) {
  return (
    <div>
      <Typography.Title level={3} style={{ marginTop: 0 }}>
        经侦工具
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        按流程完成数据清洗、资金穿透、团伙画像，并一键生成案件研判报告。
      </Typography.Paragraph>
      <Row gutter={[16, 16]}>
        {MODULES.map((m) => {
          const done = !!statusMap[m.key];
          return (
            <Col span={12} key={m.key}>
              <Card
                title={m.name}
                extra={
                  done ? (
                    <Tag color="success" icon={<CheckCircleFilled />}>
                      已完成
                    </Tag>
                  ) : (
                    <Tag icon={<ClockCircleOutlined />}>待处理</Tag>
                  )
                }
                className="module-card"
              >
                <Typography.Paragraph>{m.desc}</Typography.Paragraph>
                <Button type="primary" onClick={() => onOpenModule(m.key)}>
                  进入模块
                </Button>
              </Card>
            </Col>
          );
        })}
      </Row>
    </div>
  );
}
