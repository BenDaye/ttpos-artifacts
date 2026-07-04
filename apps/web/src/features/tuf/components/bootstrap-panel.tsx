import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/shared/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { generateTufPythonScript } from '../scripts/generateTufScript'
import { ScriptOutput } from './script-output'

interface FormState {
  appName: string
  keyType: string
  roleName: string
  adminName: string
  rootExp: number
  timestampExp: number
  snapshotExp: number
  targetsExp: number
  rootThreshold: number
  timestampThreshold: number
  snapshotThreshold: number
  targetsThreshold: number
  delegationThreshold: number
}

const DEFAULTS: FormState = {
  appName: '',
  keyType: 'rsa',
  roleName: 'root',
  adminName: 'admin',
  rootExp: 365,
  timestampExp: 7,
  snapshotExp: 14,
  targetsExp: 90,
  rootThreshold: 1,
  timestampThreshold: 1,
  snapshotThreshold: 1,
  targetsThreshold: 1,
  delegationThreshold: 1,
}

export function BootstrapPanel() {
  const { t } = useTranslation(['settings', 'common'])
  const [form, setForm] = useState<FormState>(DEFAULTS)
  const [output, setOutput] = useState<string | null>(null)

  const onGenerate = () => {
    if (!form.appName.trim()) {
      return
    }
    const script = generateTufPythonScript({
      appName: form.appName,
      keyType: form.keyType,
      roleName: form.roleName,
      adminName: form.adminName,
      expiration: {
        root: form.rootExp,
        timestamp: form.timestampExp,
        snapshot: form.snapshotExp,
        targets: form.targetsExp,
      },
      thresholds: {
        root: form.rootThreshold,
        timestamp: form.timestampThreshold,
        snapshot: form.snapshotThreshold,
        targets: form.targetsThreshold,
        delegation: form.delegationThreshold,
      },
    })
    setOutput(script)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('tuf.bootstrap.title', { defaultValue: 'Bootstrap script' })}</CardTitle>
        <CardDescription>
          {t('tuf.bootstrap.description', { defaultValue: 'Generate a Python script that initializes TUF metadata for an application.' })}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label={t('tuf.fields.appName', { defaultValue: 'App name' })}>
            <Input
              value={form.appName}
              onChange={e => setForm(s => ({ ...s, appName: e.target.value }))}
              placeholder="ttpos-pos"
            />
          </Field>
          <Field label={t('tuf.fields.keyType', { defaultValue: 'Key type' })}>
            <Input
              value={form.keyType}
              onChange={e => setForm(s => ({ ...s, keyType: e.target.value }))}
            />
          </Field>
          <Field label={t('tuf.fields.adminName', { defaultValue: 'Admin name' })}>
            <Input
              value={form.adminName}
              onChange={e => setForm(s => ({ ...s, adminName: e.target.value }))}
            />
          </Field>
          <Field label={t('tuf.fields.roleName', { defaultValue: 'Role name' })}>
            <Input
              value={form.roleName}
              onChange={e => setForm(s => ({ ...s, roleName: e.target.value }))}
            />
          </Field>
        </div>

        <div className="grid gap-3 md:grid-cols-4">
          <NumberField label="root exp (days)" value={form.rootExp} onChange={v => setForm(s => ({ ...s, rootExp: v }))} />
          <NumberField label="timestamp exp" value={form.timestampExp} onChange={v => setForm(s => ({ ...s, timestampExp: v }))} />
          <NumberField label="snapshot exp" value={form.snapshotExp} onChange={v => setForm(s => ({ ...s, snapshotExp: v }))} />
          <NumberField label="targets exp" value={form.targetsExp} onChange={v => setForm(s => ({ ...s, targetsExp: v }))} />
          <NumberField label="root threshold" value={form.rootThreshold} onChange={v => setForm(s => ({ ...s, rootThreshold: v }))} />
          <NumberField label="timestamp threshold" value={form.timestampThreshold} onChange={v => setForm(s => ({ ...s, timestampThreshold: v }))} />
          <NumberField label="snapshot threshold" value={form.snapshotThreshold} onChange={v => setForm(s => ({ ...s, snapshotThreshold: v }))} />
          <NumberField label="targets threshold" value={form.targetsThreshold} onChange={v => setForm(s => ({ ...s, targetsThreshold: v }))} />
          <NumberField label="delegation threshold" value={form.delegationThreshold} onChange={v => setForm(s => ({ ...s, delegationThreshold: v }))} />
        </div>

        <div className="flex gap-2">
          <Button onClick={onGenerate} disabled={!form.appName.trim()}>
            {t('tuf.actions.generate', { defaultValue: 'Generate script' })}
          </Button>
          <Button
            variant="ghost"
            onClick={() => {
              setForm(DEFAULTS)
              setOutput(null)
            }}
          >
            {t('common:actions.reset', { defaultValue: 'Reset' })}
          </Button>
        </div>

        {output && <ScriptOutput script={output} />}
      </CardContent>
    </Card>
  )
}

function Field({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (n: number) => void
}) {
  return (
    <div className="space-y-2">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        value={value}
        min={1}
        onChange={e => onChange(Number.parseInt(e.target.value || '0', 10) || 0)}
      />
    </div>
  )
}
