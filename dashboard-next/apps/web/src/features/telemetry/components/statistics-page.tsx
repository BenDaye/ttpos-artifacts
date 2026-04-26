import type { TelemetrySummary, TelemetryVersions } from '../api'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { EmptyState } from '@/shared/components/empty-state'
import { PageHeader } from '@/shared/components/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { useTelemetryQuery } from '../hooks'
import { EMPTY_TELEMETRY_FILTERS, TelemetryFilterBar } from './filter-bar'

const tooltipStyle = {
  background: 'var(--popover)',
  borderColor: 'var(--border)',
  borderRadius: 8,
  fontSize: 12,
} as const

interface BucketDatum {
  name: string
  count: number
}

export function StatisticsPage() {
  const { t } = useTranslation(['telemetry', 'common'])
  const [filters, setFilters] = useState(EMPTY_TELEMETRY_FILTERS)
  const telemetry = useTelemetryQuery({
    range: filters.range,
    apps: filters.apps.length > 0 ? filters.apps : undefined,
    channels: filters.channels.length > 0 ? filters.channels : undefined,
    platforms: filters.platforms.length > 0 ? filters.platforms : undefined,
    architectures: filters.architectures.length > 0 ? filters.architectures : undefined,
  })

  return (
    <div>
      <PageHeader
        title={t('common:nav.statistics')}
        description={t('description', { defaultValue: 'Adoption and download metrics across releases.' })}
      />
      <TelemetryFilterBar value={filters} onChange={setFilters} />

      {telemetry.isPending && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      )}

      {telemetry.isError && (
        <EmptyState
          title={t('common:states.error')}
          description={(telemetry.error as Error)?.message}
        />
      )}

      {telemetry.isSuccess && (
        <>
          <SummaryGrid summary={telemetry.data.summary} />
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <DailyTrendCard
              title={t('charts.daily', { defaultValue: 'Activity over time' })}
              data={telemetry.data.daily_stats ?? []}
            />
            <BucketChartCard
              title={t('charts.platforms', { defaultValue: 'By platform' })}
              data={(telemetry.data.platforms ?? []).map(p => ({ name: p.platform, count: p.client_count }))}
            />
            <BucketChartCard
              title={t('charts.channels', { defaultValue: 'By channel' })}
              data={(telemetry.data.channels ?? []).map(c => ({ name: c.channel, count: c.client_count }))}
            />
            <BucketChartCard
              title={t('charts.architectures', { defaultValue: 'By architecture' })}
              data={(telemetry.data.architectures ?? []).map(a => ({ name: a.arch, count: a.client_count }))}
            />
            <VersionUsageCard
              title={t('charts.versions', { defaultValue: 'Top versions' })}
              versions={telemetry.data.versions}
              className="lg:col-span-2"
            />
          </div>
        </>
      )}
    </div>
  )
}

function SummaryGrid({ summary }: { summary?: TelemetrySummary }) {
  const { t } = useTranslation('telemetry')
  if (!summary) {
    return null
  }
  const items = [
    { label: t('summary.requests', { defaultValue: 'Requests' }), value: summary.total_requests ?? 0 },
    { label: t('summary.clients', { defaultValue: 'Unique clients' }), value: summary.unique_clients ?? 0 },
    { label: t('summary.latest', { defaultValue: 'On latest version' }), value: summary.clients_using_latest_version ?? 0 },
    { label: t('summary.outdated', { defaultValue: 'Outdated clients' }), value: summary.clients_outdated ?? 0 },
    { label: t('summary.apps', { defaultValue: 'Active apps' }), value: summary.total_active_apps ?? 0 },
  ]
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {items.map(item => (
        <Card key={item.label}>
          <CardHeader className="pb-2">
            <CardDescription>{item.label}</CardDescription>
            <CardTitle className="text-3xl tabular-nums">
              {Number(item.value).toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}

function DailyTrendCard({
  title,
  data,
}: {
  title: string
  data: { date: string, total_requests: number, unique_clients: number }[]
}) {
  const { t } = useTranslation('telemetry')
  if (data.length === 0) {
    return (
      <ChartShell title={title}>
        <EmptyChart />
      </ChartShell>
    )
  }
  return (
    <ChartShell title={title}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="date" tickLine={false} stroke="var(--muted-foreground)" fontSize={11} />
          <YAxis tickLine={false} stroke="var(--muted-foreground)" fontSize={11} />
          <Tooltip
            cursor={{ stroke: 'var(--accent)' }}
            contentStyle={tooltipStyle}
          />
          <Line
            type="monotone"
            dataKey="total_requests"
            name={t('summary.requests', { defaultValue: 'Requests' })}
            stroke="var(--chart-1)"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="unique_clients"
            name={t('summary.clients', { defaultValue: 'Unique clients' })}
            stroke="var(--chart-2)"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}

function BucketChartCard({ title, data }: { title: string, data: BucketDatum[] }) {
  if (data.length === 0) {
    return (
      <ChartShell title={title}>
        <EmptyChart />
      </ChartShell>
    )
  }
  return (
    <ChartShell title={title}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tickLine={false} stroke="var(--muted-foreground)" fontSize={11} />
          <YAxis tickLine={false} stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
          <Tooltip cursor={{ fill: 'var(--accent)' }} contentStyle={tooltipStyle} />
          <Bar dataKey="count" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}

function VersionUsageCard({
  title,
  versions,
  className,
}: {
  title: string
  versions?: TelemetryVersions
  className?: string
}) {
  const usage = versions?.usage ?? []
  if (usage.length === 0) {
    return (
      <ChartShell title={title} className={className}>
        <EmptyChart />
      </ChartShell>
    )
  }
  const data: BucketDatum[] = usage.map(u => ({ name: u.version, count: u.client_count }))
  return (
    <ChartShell title={title} className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 8, bottom: 0, left: -20 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="name" tickLine={false} stroke="var(--muted-foreground)" fontSize={11} />
          <YAxis tickLine={false} stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
          <Tooltip cursor={{ fill: 'var(--accent)' }} contentStyle={tooltipStyle} />
          <Bar dataKey="count" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}

function ChartShell({
  title,
  className,
  children,
}: {
  title: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-64 pt-0">{children}</CardContent>
    </Card>
  )
}

function EmptyChart() {
  const { t } = useTranslation('common')
  return (
    <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
      {t('states.empty')}
    </p>
  )
}
