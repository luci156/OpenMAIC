'use client';

import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SlotCapability } from '@/lib/config/model-slots';
import { useI18n } from '@/lib/hooks/use-i18n';
import type { ApplyChange, ModelSettingsView, PresetView } from '@/lib/model-settings/client';
import { emptyDraft, newProviderId, providerChange } from '@/lib/model-settings/edit';
import { reportApply } from './server-settings';

export function AddCapabilityServiceDialog({
  open,
  onOpenChange,
  view,
  apply,
  capability,
  serviceLabel,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  view: ModelSettingsView;
  apply: ApplyChange;
  capability: SlotCapability;
  serviceLabel: string;
  onAdded: (providerId: string) => void;
}) {
  const { t } = useI18n();
  const presets = useMemo(
    () =>
      view.presets.filter(
        (preset) =>
          preset.kind === 'single' &&
          !preset.requiresCredentials &&
          preset.capabilities[capability],
      ),
    [view.presets, capability],
  );
  const [presetId, setPresetId] = useState('');
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const preset = presets.find((item) => item.id === presetId) ?? presets[0];
  const effectiveName = name || preset?.name || '';
  const slug = effectiveName.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 59);

  const reset = () => {
    setPresetId('');
    setName('');
    setApiKey('');
    setBaseUrl('');
  };

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) reset();
  };

  const handleAdd = async () => {
    if (!preset || !slug || (preset.requiresBaseUrl && !baseUrl.trim())) return;
    const id = newProviderId(view, slug);
    const draft = { ...emptyDraft(preset.id), apiKey: apiKey.trim(), baseUrl: baseUrl.trim() };
    setSaving(true);
    try {
      const result = await apply(providerChange(id, draft, preset), view);
      if (reportApply(result, t)) {
        onAdded(id);
        handleOpenChange(false);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogTitle>{t('settings.addProviderDialog')}</DialogTitle>
        <DialogDescription>{t('settings.addProviderDescription')}</DialogDescription>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{serviceLabel}</Label>
            <select
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={preset?.id ?? ''}
              onChange={(event) => {
                const next = presets.find((item) => item.id === event.target.value);
                setPresetId(event.target.value);
                if (next) {
                  setName(next.name);
                  setBaseUrl(next.capabilities[capability]?.baseUrl ?? '');
                }
              }}
            >
              {presets.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label>{t('settings.providerName')}</Label>
            <Input value={effectiveName} onChange={(event) => setName(event.target.value)} />
            {slug && <p className="text-xs text-muted-foreground">{t('settings.serverConfig.providerIdHint', { id: slug })}</p>}
          </div>
          {preset?.requiresBaseUrl && (
            <div className="space-y-2">
              <Label>{t('settings.defaultBaseUrl')}</Label>
              <Input type="url" placeholder="https://api.example.com" value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} />
            </div>
          )}
          <div className="space-y-2">
            <Label>API Key</Label>
            <Input type="password" autoComplete="new-password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} />
          </div>
          <div className="flex justify-end gap-2 border-t pt-3">
            <Button variant="outline" size="sm" onClick={() => handleOpenChange(false)}>{t('settings.cancelEdit')}</Button>
            <Button size="sm" onClick={() => void handleAdd()} disabled={!preset || !slug || (preset.requiresBaseUrl && !baseUrl.trim()) || saving} className="gap-1.5">
              <Plus className="size-3.5" />{t('settings.addProviderButton')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
