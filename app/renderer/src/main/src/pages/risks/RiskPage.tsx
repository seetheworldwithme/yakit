import React, { useEffect, useRef, useState } from 'react'
import { RiskPageProp } from './RiskPageType'
import styles from './RiskPage.module.scss'
import { YakitSpin } from '@/components/yakitUI/YakitSpin/YakitSpin'
import { shallow } from 'zustand/shallow'
import { PageNodeItemProps, usePageInfo } from '@/store/pageInfo'
import { YakitRoute } from '@/enums/yakitRoute'
import { defaultRiskPageInfo } from '@/defaultConstants/RiskPage'
import { YakitRiskTable } from './YakitRiskTable/YakitRiskTable'
import { QueryRisksRequest } from './YakitRiskTable/YakitRiskTableType'
import { defQueryRisksRequest } from './YakitRiskTable/constants'
import emiter from '@/utils/eventBus/eventBus'

export const RiskPage: React.FC<RiskPageProp> = (props) => {
  const { queryPagesDataById } = usePageInfo(
    (s) => ({
      queryPagesDataById: s.queryPagesDataById,
    }),
    shallow,
  )
  const initPageInfo = () => {
    const currentItem: PageNodeItemProps | undefined = queryPagesDataById(YakitRoute.DB_Risk, YakitRoute.DB_Risk)
    if (currentItem && currentItem.pageParamsInfo.riskPageInfo) {
      return currentItem.pageParamsInfo.riskPageInfo
    } else {
      return { ...defaultRiskPageInfo }
    }
  }

  useEffect(() => {
    const specifyVulnerabilityLevel = (params: string) => {
      try {
        const SeverityList = JSON.parse(params) || []
        setQuery((query) => ({ ...query, SeverityList }))
      } catch (error) {}
    }
    emiter.on('specifyVulnerabilityLevel', specifyVulnerabilityLevel)
    return () => {
      emiter.off('specifyVulnerabilityLevel', specifyVulnerabilityLevel)
    }
  }, [])

  const [riskLoading, setRiskLoading] = useState<boolean>(false)
  const [query, setQuery] = useState<QueryRisksRequest>({
    ...defQueryRisksRequest,
    SeverityList: initPageInfo().SeverityList || [],
  })

  return (
    <YakitSpin spinning={riskLoading}>
      <div className={styles['risk-page']}>
        <YakitRiskTable query={query} setQuery={setQuery} setRiskLoading={setRiskLoading} compactRiskDetail={true} />
      </div>
    </YakitSpin>
  )
}
