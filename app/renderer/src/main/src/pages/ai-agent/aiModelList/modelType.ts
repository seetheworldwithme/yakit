import { AIModelTypeEnum, AIModelTypeEnumType, AIModelTypeInterFileNameEnum } from '../defaultConstant'
import type { AIModelTypeFileName } from './utils'

/**获取ai模型对应的键名,通过模型类型 */
export const getFileNameByModelType = (type: AIModelTypeEnumType) => {
  let fileName: AIModelTypeFileName | null = null
  switch (type) {
    case AIModelTypeEnum.TierIntelligent:
      fileName = AIModelTypeInterFileNameEnum.IntelligentModels
      break
    case AIModelTypeEnum.TierLightweight:
      fileName = AIModelTypeInterFileNameEnum.LightweightModels
      break
    case AIModelTypeEnum.TierVision:
      fileName = AIModelTypeInterFileNameEnum.VisionModels
      break
    default:
      break
  }
  return fileName
}

/**通过键名获取对应的模型类型 */
export const getModelTypeByFileName = (fileName: string) => {
  let modelType: AIModelTypeEnumType | null = null
  switch (fileName) {
    case AIModelTypeInterFileNameEnum.IntelligentModels:
      modelType = AIModelTypeEnum.TierIntelligent
      break
    case AIModelTypeInterFileNameEnum.LightweightModels:
      modelType = AIModelTypeEnum.TierLightweight
      break
    case AIModelTypeInterFileNameEnum.VisionModels:
      modelType = AIModelTypeEnum.TierVision
      break
    default:
      break
  }
  return modelType
}

export const getModelLabelByModelType = (type: AIModelTypeEnumType) => {
  let label: string = ''
  switch (type) {
    case AIModelTypeEnum.TierIntelligent:
      label = '高质模型'
      break
    case AIModelTypeEnum.TierLightweight:
      label = '轻量模型'
      break
    case AIModelTypeEnum.TierVision:
      label = '视觉模型'
      break
    default:
      label = '未知类型'
      break
  }
  return label
}
