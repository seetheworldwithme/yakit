import React, { useEffect, useState, useLayoutEffect } from 'react'
import { Modal } from 'antd'
import { ExclamationCircleOutlined, GithubOutlined, RightOutlined, WechatOutlined } from '@ant-design/icons'
import { failed } from '@/utils/notification'
import './Login.scss'
import { NetWorkApi } from '@/services/fetch'
import { ConfigPrivateDomain } from '@/components/ConfigPrivateDomain/ConfigPrivateDomain'
import { showModal } from '../utils/showModal'
import { isEnterpriseEdition } from '@/utils/envfile'
import { apiDownloadPluginMine } from './plugins/utils'
import { YakitModalConfirm } from '@/components/yakitUI/YakitModal/YakitModalConfirm'
import { YakitSpin } from '@/components/yakitUI/YakitSpin/YakitSpin'
import { useI18nNamespaces } from '@/i18n/useI18nNamespaces'
import { yakitAuth } from '@/services/electronBridge'

export interface LoginProp {
  visible: boolean
  onCancel: () => any
}

interface LoginParamsProp {
  source: string
}

const Login: React.FC<LoginProp> = (props) => {
  const { t } = useI18nNamespaces(['core'])
  const [loading, setLoading] = useState<boolean>(false)
  // 打开企业登录面板
  const openEnterpriseModal = () => {
    props.onCancel()
    const m = showModal({
      title: '',
      centered: true,
      width: 760,
      bodyStyle: { padding: 0 },
      wrapClassName: 'sentinel-enterprise-login-wrap',
      content: <ConfigPrivateDomain onClose={() => m.destroy()} enterpriseLogin={true} />,
    })
    return m
  }
  {
    /* 屏蔽企业登录选择 将登录直接替换为企业登录 */
  }
  useLayoutEffect(() => {
    if (isEnterpriseEdition()) {
      openEnterpriseModal()
    }
  }, [])
  const fetchLogin = (type: string) => {
    setLoading(true)
    if (type === 'login') {
      openEnterpriseModal()
    } else {
      NetWorkApi<LoginParamsProp, string>({
        method: 'get',
        url: 'auth/from',
        params: {
          source: type,
        },
      })
        .then((res) => {
          if (res) yakitAuth.startUserSignIn({ url: res, type })
        })
        .catch((err) => {
          failed(t('Login.loginError', { error: err }))
        })
        .finally(() => {
          setTimeout(() => setLoading(false), 200)
        })
    }
  }
  // 全局监听登录状态
  useEffect(() => {
    const cleanup = yakitAuth.onSignInData((res: any) => {
      const { ok, info } = res
      if (ok) {
        const m = YakitModalConfirm({
          type: 'white',
          title: (modalT) => modalT('Login.dataSync'),
          icon: <ExclamationCircleOutlined />,
          content: (modalT) => modalT('Login.syncDataConfirm'),
          onOk() {
            apiDownloadPluginMine()
            setTimeout(() => setLoading(false), 200)
            props.onCancel()
            m.destroy()
          },
          onCancel() {
            setTimeout(() => setLoading(false), 200)
            props.onCancel()
            m.destroy()
          },
        })
      } else {
        failed(info)
        setTimeout(() => setLoading(false), 200)
        props.onCancel()
      }
    })
    return () => {
      cleanup()
    }
  }, [])
  return (
    <Modal
      visible={props.visible}
      closable={false}
      footer={null}
      onCancel={() => props.onCancel()}
      bodyStyle={{ padding: 0 }}
      width={760}
      style={{ top: '18%' }}
      wrapClassName="sentinel-login-modal-wrap"
      className="sentinel-login-modal"
    >
      <YakitSpin spinning={loading}>
        <section className="sentinel-login-shell">
          {/* 左半：品牌宣传区，带 Sentinel 科技蓝网格底纹 */}
          <aside className="sentinel-login-brand">
            <div className="brand-grid-bg" aria-hidden="true" />
            <div className="brand-grid-glow" aria-hidden="true" />
            <header className="brand-head">
              <span className="brand-mark" />
              <span className="brand-name">靖云甲web应用漏洞扫描系统</span>
            </header>
            <div className="brand-tagline">
              <h3 className="brand-tagline-title">企业级安全测试平台</h3>
              <p className="brand-tagline-sub">一体化渗透测试 · 流量审计 · 资产测绘</p>
            </div>
            <ul className="brand-points">
              <li className="brand-point">
                <span className="brand-point-dot" />
                <span className="brand-point-text">多源威胁情报与协同检测</span>
              </li>
              <li className="brand-point">
                <span className="brand-point-dot" />
                <span className="brand-point-text">私有化部署，数据自主可控</span>
              </li>
              <li className="brand-point">
                <span className="brand-point-dot" />
                <span className="brand-point-text">插件生态与脚本扩展能力</span>
              </li>
            </ul>
            <footer className="brand-foot">© 靖云甲web应用漏洞扫描系统</footer>
          </aside>

          {/* 右半：登录方式表单区 */}
          <main className="sentinel-login-main">
            <header className="login-main-head">
              <h2 className="login-main-title">{t('Login.login')}</h2>
              <p className="login-main-step">
                <span className="login-step-no">01</span>
                <span className="login-step-text">选择以下方式完成身份认证</span>
              </p>
            </header>

            <nav className="login-method-grid" aria-label="login methods">
              {/*<div className='login-icon' onClick={() => githubAuth()}>*/}
              <button type="button" className="method-card" onClick={() => fetchLogin('github')}>
                <span className="method-card-index">01</span>
                <span className="method-card-icon github">
                  <GithubOutlined />
                </span>
                <span className="method-card-title">{t('Login.loginWithGithub')}</span>
                <RightOutlined className="method-card-arrow" />
              </button>
              <button type="button" className="method-card" onClick={() => fetchLogin('wechat')}>
                <span className="method-card-index">02</span>
                <span className="method-card-icon wechat">
                  <WechatOutlined />
                </span>
                <span className="method-card-title">{t('Login.loginWithWechat')}</span>
                <RightOutlined className="method-card-arrow" />
              </button>
            </nav>

            <footer className="login-main-foot">
              登录即代表同意将账号与当前终端绑定，认证后可在「我的」中管理授权。
            </footer>
          </main>
        </section>
      </YakitSpin>
    </Modal>
  )
}

export default Login
