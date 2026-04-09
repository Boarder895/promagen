/**
 * Sentinel Weekly Digest Dashboard
 *
 * Server component that fetches the last 12 weeks of Sentinel data
 * and renders the SentinelDashboard client component.
 *
 * Route: /admin/sentinel
 *
 * Authority: sentinel.md v1.2.0
 * Existing features preserved: Yes
 */

import type { Metadata } from 'next';
import { fetchDashboardData } from '@/lib/sentinel/dashboard-data';
import { SentinelDashboard } from '@/components/sentinel/dashboard';

export const metadata: Metadata = {
  title: 'Sentinel Dashboard — Promagen',
  robots: { index: false, follow: false },
};

export default async function SentinelPage() {
  const data = await fetchDashboardData(12);

  if (!data.available) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0F172A',
        color: '#E2E8F0',
        fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 'clamp(1.5rem, 2vw, 2rem)', marginBottom: '1rem' }}>
            Sentinel Dashboard
          </h1>
          <p style={{ color: '#E2E8F0' }}>
            No data available yet. Sentinel needs at least one completed Monday run.
          </p>
        </div>
      </div>
    );
  }

  return <SentinelDashboard data={data} />;
}

export const dynamic = 'force-dynamic';
