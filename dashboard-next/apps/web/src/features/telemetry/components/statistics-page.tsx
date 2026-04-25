import type { TelemetryRange } from '../api'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { EmptyState } from '@/shared/components/empty-state'
import { PageHeader } from '@/shared/components/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Skeleton } from '@/shared/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/shared/components/ui/toggle-group'
import { useTelemetryQuery } from '../hooks'

const RANGES: TelemetryRange[] = ['today', 'week', 'month']

export function StatisticsPage() {
  const { t } = useTranslation(['telemetry', 'common'])
  const [range, setRange] = useState<TelemetryRange>('week')
  const telemetry = useTelemetryQuery({ range })

  return (
    <div>
      <PageHeader
        title={t('common:nav.statistics')}
        description={t('description', { defaultValue: 'Adoption and download metrics across releases.' })}
        actions={(
          <ToggleGroup>
            {RANGES.map(r => (
              <ToggleGroupItem
                key={r}
                value={r}
                aria-pressed={r === range}
                data-pressed={r === range}
                onClick={() => setRange(r)}
              >
                {t(`range.${r}`, { defaultValue: r })}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        )}
      />

      {telemetry.isPending && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
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
            <ChartCard
              title={t('charts.daily', { defaultValue: 'Downloads over time' })}
              data={telemetry.data.daily_stats?.map(d => ({ name: d.date, total: d.total })) ?? []}
            />
            <ChartCard
              title={t('charts.platforms', { defaultValue: 'By platform' })}
              data={telemetry.data.platforms ?? []}
            />
            <ChartCard
              title={t('charts.channels', { defaultValue: 'By channel' })}
              data={telemetry.data.channels ?? []}
            />
            <ChartCard
              title={t('charts.versions', { defaultValue: 'Top versions' })}
              data={telemetry.data.versions ?? []}
            />
          </div>
        </>
      )}
    </div>
  )
}

function SummaryGrid({ summary }: { summary?: { total_downloads?: number, unique_apps?: number, unique_versions?: number, unique_users?: number } }) {
  const { t } = useTranslation('telemetry')
  if (!summary) {
    return null
  }
  const items = [
    { label: t('summary.downloads', { defaultValue: 'Downloads' }), value: summary.total_downloads ?? 0 },
    { label: t('summary.apps', { defaultValue: 'Applications' }), value: summary.unique_apps ?? 0 },
    { label: t('summary.versions', { defaultValue: 'Versions' }), value: summary.unique_versions ?? 0 },
    { label: t('summary.users', { defaultValue: 'Unique users' }), value: summary.unique_users ?? 0 },
  ]
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {items.map(item => (
        <Card key={item.label}>
          <CardHeader className="pb-2">
            <CardDescription>{item.label}</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{item.value.toLocaleString()}</CardTitle>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}

function ChartCard({ title, data }: { title: string, data: { name: string, total: number }[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-64 pt-0">
        {data.length === 0
          ? (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                —
              </p>
            )
          : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tickLine={false} stroke="var(--muted-foreground)" fontSize={11} />
                  <YAxis tickLine={false} stroke="var(--muted-foreground)" fontSize={11} />
                  <Tooltip
                    cursor={{ fill: 'var(--accent)' }}
                    contentStyle={{
                      background: 'var(--popover)',
                      borderColor: 'var(--border)',
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="total" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
      </CardContent>
    </Card>
  )
}
