import React, { useEffect, useImperativeHandle, useRef, useState } from 'react'
import styles from './MITMServerStartForm.module.scss'
import { YakitModal } from '@/components/yakitUI/YakitModal/YakitModal'
import { YakitTag } from '@/components/yakitUI/YakitTag/YakitTag'
import { YakEditor } from '@/utils/editors'
import { CaCertData } from '../MITMServerHijacking/MITMServerHijacking'
import { useMemoizedFn } from 'ahooks'
import { saveABSFileToOpen } from '@/utils/openWebsite'
import { YakitCard } from '@/components/yakitUI/YakitCard/YakitCard'
import { YakitRadioButtons } from '@/components/yakitUI/YakitRadioButtons/YakitRadioButtons'
import { useI18nNamespaces } from '@/i18n/useI18nNamespaces'

const { ipcRenderer } = window.require('electron')

interface MITMCertificateDownloadModalProps {
  visible: boolean
  setVisible: (b: boolean) => void
}
export const MITMCertificateDownloadModal: React.FC<MITMCertificateDownloadModalProps> = React.memo((props) => {
  const { visible, setVisible } = props
  const [isGMState, setIsGMState] = useState<boolean>(false) // 是否为国密证书
  const [caCerts, setCaCerts] = useState<CaCertData>({
    CaCerts: new Uint8Array(),
    LocalFile: '',
  })
  const { t, i18n } = useI18nNamespaces(['mitm', 'yakitUi'])
  useEffect(() => {
    const apiName = isGMState ? 'DownloadMITMGMCert' : 'DownloadMITMCert'
    ipcRenderer.invoke(apiName, {}).then((data: CaCertData) => {
      setCaCerts(data)
    })
  }, [isGMState])
  /**
   * @description 下载证书
   */
  const onDown = useMemoizedFn(() => {
    if (!caCerts.CaCerts) return
    const fileName = isGMState ? '国密证书.crt.pem' : '证书.crt.pem'
    saveABSFileToOpen(fileName, caCerts.CaCerts)
  })
  return (
    <YakitModal
      visible={visible}
      onCancel={() => setVisible(false)}
      closable={true}
      title={
        <div className={styles['certificate-download-modal-title']}>
          <div className={styles['certificate-download-modal-title-text']}>证书下载</div>
          {/* 证书下载提示按产品要求隐藏，保留代码以备恢复
              <div className={styles['certificate-download-modal-hint']}>
                {t('MITMCertificateDownloadModal.after_proxy_visit')}
                <YakitTag enableCopy copyText="http://mitm" iconColor="var(--Colors-Use-Main-Primary)" />
                {t('MITMCertificateDownloadModal.auto_download_cert')}
              </div>
              */}
        </div>
      }
      width={720}
      className={styles['mitm-certificate-download-modal']}
      okText={'下载'}
      onOk={() => onDown()}
      bodyStyle={{ padding: 8 }}
    >
      <YakitCard
        title={
          <YakitRadioButtons
            buttonStyle="solid"
            options={[
              {
                value: false,
                label: 'SSL 证书',
              },
              {
                value: true,
                label: '国密证书',
              },
            ]}
            value={isGMState}
            onChange={(e) => {
              setIsGMState(e.target.value)
            }}
          />
        }
        style={{ borderRadius: 4 }}
        headStyle={{ height: 36 }}
        bodyStyle={{ padding: 0 }}
      >
        <div className={styles['certificate-download-modal-body']}>
          <YakEditor bytes={true} valueBytes={caCerts.CaCerts} />
        </div>
      </YakitCard>
    </YakitModal>
  )
})

export default MITMCertificateDownloadModal
