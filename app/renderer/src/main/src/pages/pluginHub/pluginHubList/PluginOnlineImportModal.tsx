import React, { memo, useEffect, useState } from 'react'
import { Form } from 'antd'
import { useMemoizedFn } from 'ahooks'
import { YakitModal } from '@/components/yakitUI/YakitModal/YakitModal'
import { YakitFormDragger } from '@/components/yakitUI/YakitForm/YakitForm'
import { YakitInput } from '@/components/yakitUI/YakitInput/YakitInput'
import { yakitUpload } from '@/services/electronBridge'
import { yakitNotify } from '@/utils/notification'

interface PluginOnlineImportModalProps {
  visible: boolean
  onCancel: () => void
  onSuccess: () => void
}

export const PluginOnlineImportModal: React.FC<PluginOnlineImportModalProps> = memo((props) => {
  const { visible, onCancel, onSuccess } = props
  const [form] = Form.useForm()
  const [pluginPath, setPluginPath] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!visible) return
    form.resetFields()
    setPluginPath('')
  }, [visible])

  const onImport = useMemoizedFn(async () => {
    const values = form.getFieldsValue()
    if (!values.pluginPath) {
      yakitNotify('warning', '请选择插件包')
      return
    }

    setLoading(true)
    try {
      const response = await yakitUpload.importPluginPackage({ path: values.pluginPath, password: values.password })
      if (response?.code !== 200) {
        throw new Error(response?.message || response?.data?.reason || '插件导入失败')
      }
      const result = response.data || {}
      yakitNotify(
        'success',
        `插件导入完成：成功 ${result.imported?.length || 0} 个，跳过 ${result.skipped?.length || 0} 个，失败 ${
          result.failed?.length || 0
        } 个`,
      )
      onSuccess()
    } catch (error) {
      yakitNotify('error', `插件导入失败：${error}`)
    } finally {
      setLoading(false)
    }
  })

  return (
    <YakitModal
      type="white"
      visible={visible}
      title="批量导入到云端"
      width={560}
      maskClosable={false}
      onCancel={onCancel}
      onOk={onImport}
      confirmLoading={loading}
      okText="导入"
    >
      <Form form={form}>
        <YakitFormDragger
          formItemProps={{
            name: 'pluginPath',
            label: '插件包',
            labelCol: { span: 4 },
            wrapperCol: { span: 20 },
            rules: [{ required: true, message: '请选择插件包' }],
          }}
          selectType="file"
          multiple={false}
          accept=".zip,.ZIP,.enc,.ENC"
          fileExtensionIsExist
          value={pluginPath}
          onChange={(value) => {
            setPluginPath(value)
            form.setFieldsValue({ pluginPath: value })
          }}
        />
        <Form.Item label="解密密码" name="password" labelCol={{ span: 4 }} wrapperCol={{ span: 20 }}>
          <YakitInput.Password placeholder="加密插件包请输入密码" />
        </Form.Item>
      </Form>
    </YakitModal>
  )
})
