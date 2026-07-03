import React from 'react'
import { ReactComponent as AIAgentSvg } from './ai-agent.svg'
import { ReactComponent as AuditCodeSvg } from './audit-code.svg'
import { ReactComponent as AuditHoleSvg } from './audit-hole.svg'
import { ReactComponent as BatchPluginSvg } from './batch-plugin.svg'
import { ReactComponent as BruteSvg } from './brute.svg'
import { ReactComponent as CodeScanSvg } from './code-scan.svg'
import { ReactComponent as CodecSvg } from './codec.svg'
import { ReactComponent as CveSvg } from './cve.svg'
import { ReactComponent as DataCompareSvg } from './data-compare.svg'
import { ReactComponent as DirectoryScanSvg } from './directory-scan.svg'
import { ReactComponent as DNSLogSvg } from './dnslog.svg'
import { ReactComponent as DomainAssetsSvg } from './domain-assets.svg'
import { ReactComponent as FingerprintSvg } from './fingerprint.svg'
import { ReactComponent as HistorySvg } from './history.svg'
import { ReactComponent as ICMPSizeLogSvg } from './icmp-size-log.svg'
import { ReactComponent as KnowledgeBaseSvg } from './knowledge-base.svg'
import { ReactComponent as MitmSvg } from './mitm.svg'
import { ReactComponent as PayloadGeneraterSvg } from './payload-generater.svg'
import { ReactComponent as PayloadSvg } from './payload.svg'
import { ReactComponent as PluginHubSvg } from './plugin-hub.svg'
import { ReactComponent as PocSvg } from './poc.svg'
import { ReactComponent as PortAssetsSvg } from './port-assets.svg'
import { ReactComponent as PortListenerSvg } from './port-listener.svg'
import { ReactComponent as ProjectManagerSvg } from './project-manager.svg'
import { ReactComponent as ReportSvg } from './report.svg'
import { ReactComponent as ReverseServerSvg } from './reverse-server.svg'
import { ReactComponent as RiskSvg } from './risk.svg'
import { ReactComponent as RuleManagementSvg } from './rule-management.svg'
import { ReactComponent as ScanPortSvg } from './scan-port.svg'
import { ReactComponent as TCPPortLogSvg } from './tcp-port-log.svg'
import { ReactComponent as WebFuzzerSvg } from './web-fuzzer.svg'

type SentinelHomeIconProps = React.SVGProps<SVGSVGElement>
type SentinelHomeIconComponent = React.FunctionComponent<SentinelHomeIconProps>

const createSentinelHomeIcon = (IconComponent: SentinelHomeIconComponent) => {
  return (props: SentinelHomeIconProps) => <IconComponent aria-hidden="true" focusable="false" {...props} />
}

export const SentinelHomeMitmIcon = createSentinelHomeIcon(MitmSvg)
export const SentinelHomeWebFuzzerIcon = createSentinelHomeIcon(WebFuzzerSvg)
export const SentinelHomeScanPortIcon = createSentinelHomeIcon(ScanPortSvg)
export const SentinelHomePocIcon = createSentinelHomeIcon(PocSvg)
export const SentinelHomeBruteIcon = createSentinelHomeIcon(BruteSvg)
export const SentinelHomeDirectoryScanIcon = createSentinelHomeIcon(DirectoryScanSvg)
export const SentinelHomeFingerprintIcon = createSentinelHomeIcon(FingerprintSvg)
export const SentinelHomeBatchPluginIcon = createSentinelHomeIcon(BatchPluginSvg)
export const SentinelHomeProjectManagerIcon = createSentinelHomeIcon(ProjectManagerSvg)
export const SentinelHomeAuditCodeIcon = createSentinelHomeIcon(AuditCodeSvg)
export const SentinelHomeAIAgentIcon = createSentinelHomeIcon(AIAgentSvg)
export const SentinelHomeCodeScanIcon = createSentinelHomeIcon(CodeScanSvg)
export const SentinelHomeRuleManagementIcon = createSentinelHomeIcon(RuleManagementSvg)
export const SentinelHomeAuditHoleIcon = createSentinelHomeIcon(AuditHoleSvg)
export const SentinelHomeKnowledgeBaseIcon = createSentinelHomeIcon(KnowledgeBaseSvg)
export const SentinelHomePayloadGeneraterIcon = createSentinelHomeIcon(PayloadGeneraterSvg)
export const SentinelHomeDNSLogIcon = createSentinelHomeIcon(DNSLogSvg)
export const SentinelHomeCodecIcon = createSentinelHomeIcon(CodecSvg)
export const SentinelHomePayloadIcon = createSentinelHomeIcon(PayloadSvg)
export const SentinelHomeDataCompareIcon = createSentinelHomeIcon(DataCompareSvg)
export const SentinelHomeCVEIcon = createSentinelHomeIcon(CveSvg)
export const SentinelHomePluginHubIcon = createSentinelHomeIcon(PluginHubSvg)
export const SentinelHomePortListenerIcon = createSentinelHomeIcon(PortListenerSvg)
export const SentinelHomeICMPSizeLogIcon = createSentinelHomeIcon(ICMPSizeLogSvg)
export const SentinelHomeTCPPortLogIcon = createSentinelHomeIcon(TCPPortLogSvg)
export const SentinelHomeReverseServerIcon = createSentinelHomeIcon(ReverseServerSvg)
export const SentinelHomeHistoryIcon = createSentinelHomeIcon(HistorySvg)
export const SentinelHomeReportIcon = createSentinelHomeIcon(ReportSvg)
export const SentinelHomeRiskIcon = createSentinelHomeIcon(RiskSvg)
export const SentinelHomePortAssetsIcon = createSentinelHomeIcon(PortAssetsSvg)
export const SentinelHomeDomainAssetsIcon = createSentinelHomeIcon(DomainAssetsSvg)
