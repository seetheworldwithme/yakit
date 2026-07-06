import React from 'react'
import { usePortalStore } from '../state/portalStore'
export const Dashboard: React.FC = () => {
  const metrics = usePortalStore((s) => s.metrics)
  return (
    <section className="nova-grid">
      <article className="nova-card">
        <h2>Telemetry</h2>
        <p>{metrics.latency}ms</p>
      </article>
      <article className="nova-card">
        <h2>Throughput</h2>
        <p>{metrics.rps} rps</p>
      </article>
    </section>
  )
}
