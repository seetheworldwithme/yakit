import React, { useEffect, useMemo, useState } from "react";
import { Layout, Menu } from "antd";
import HomePage from "@/pages/HomePage";
import CleanPage from "@/pages/CleanPage";
import PenetrationPage from "@/pages/PenetrationPage";
import ProfilePage from "@/pages/ProfilePage";
import ReportPage from "@/pages/ReportPage";

const { Header, Content, Sider } = Layout;

const MENU_ITEMS = [
  { key: "home", label: "首页" },
  { key: "clean", label: "数据清洗" },
  { key: "penetration", label: "资金穿透" },
  { key: "profile", label: "团伙画像" },
  { key: "report", label: "一键报告" },
];

const VALID_PAGES = ["home", "clean", "penetration", "profile", "report"];

export default function App() {
  const [pageKey, setPageKey] = useState("home");

  // 启动时从 URL hash 读取初始页面（支持 web 端直接访问 http://host/#/clean）
  useEffect(() => {
    const hash = window.location.hash.replace("#/", "").replace("#", "");
    if (VALID_PAGES.includes(hash)) {
      setPageKey(hash);
    }
  }, []);

  // 监听 hash 变化（浏览器前进/后退、外部导航）
  useEffect(() => {
    const handler = () => {
      const hash = window.location.hash.replace("#/", "").replace("#", "");
      if (VALID_PAGES.includes(hash)) {
        setPageKey(hash);
      }
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  const [statusMap, setStatusMap] = useState({
    clean: false,
    penetration: false,
    profile: false,
    report: false,
  });
  const [latestTask, setLatestTask] = useState({
    clean: "",
    penetration: "",
    profile: "",
    report: "",
  });

  // 将当前页面同步到 URL hash
  useEffect(() => {
    if (pageKey !== "home") {
      window.location.hash = `#/${pageKey}`;
    } else {
      history.replaceState(null, "", window.location.pathname + window.location.search);
    }
  }, [pageKey]);

  const updateDone = (moduleKey, payload) => {
    setStatusMap((prev) => ({ ...prev, [moduleKey]: true }));
    if (payload?.taskId) {
      setLatestTask((prev) => ({ ...prev, [moduleKey]: payload.taskId }));
    }
  };

  const page = useMemo(() => {
    if (pageKey === "home") {
      return <HomePage statusMap={statusMap} onOpenModule={setPageKey} />;
    }
    if (pageKey === "clean") {
      return <CleanPage onBack={() => setPageKey("home")} onComplete={updateDone} />;
    }
    if (pageKey === "penetration") {
      return (
        <PenetrationPage
          onBack={() => setPageKey("home")}
          onComplete={updateDone}
          lastCleanTaskId={latestTask.clean}
        />
      );
    }
    if (pageKey === "profile") {
      return <ProfilePage onBack={() => setPageKey("home")} onComplete={updateDone} />;
    }
    return (
      <ReportPage
        onBack={() => setPageKey("home")}
        latestPenetrationTaskId={latestTask.penetration}
        latestProfileTaskId={latestTask.profile}
        onComplete={updateDone}
      />
    );
  }, [pageKey, statusMap, latestTask]);

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Sider width={220} theme="light">
        <div className="brand">Anti-Fraud MVP</div>
        <Menu
          mode="inline"
          selectedKeys={[pageKey]}
          items={MENU_ITEMS}
          onClick={({ key }) => setPageKey(key)}
          style={{ borderRight: 0 }}
        />
      </Sider>
      <Layout>
        <Header className="header">经侦研判桌面系统</Header>
        <Content style={{ padding: 20 }}>{page}</Content>
      </Layout>
    </Layout>
  );
}
