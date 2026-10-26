'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, CheckCircle2, XCircle, Zap } from 'lucide-react';
import { useI18n } from '@/lib/hooks/use-i18n';
import type { CatalogueModel } from '@/lib/config/provider-presets';
import { cn } from '@/lib/utils';
import {
  ApiKeyField,
  EndpointServerOnlyHint,
  ServerConfiguredNotice,
  ServerOnlyNotice,
  saveServiceProvider,
  type ServicePanelProps,
} from './server-settings';

/** Test a saved image or video service on the server, with its stored key. */
async function verifySavedMedia(
  kind: 'image' | 'video',
  providerId: string,
  modelId?: string,
): Promise<{ success: boolean; error?: string }> {
  const response = await fetch(`/api/verify-${kind}-provider`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ provider: providerId, ...(modelId ? { model: modelId } : {}) }),
  });
  return (await response.json()) as { success: boolean; error?: string };
}

/**
 * An image or video service: its key (write-only) with a connection test, the
 * endpoint it calls, and the models it offers. A service the server
 * configures is shown read-only, and one only the server can configure says so.
 */
export function MediaServicePanel({
  view,
  apply,
  entry,
  kind,
  defaultBaseUrl,
  catalogue,
  verifyModelId,
  children,
}: ServicePanelProps & {
  kind: 'image' | 'video';
  /** The registry's endpoint, shown as the request URL. */
  defaultBaseUrl?: string;
  /** The registry's models, for a service no provider of which is saved yet. */
  catalogue: readonly CatalogueModel[];
  /** The image model currently assigned to the workspace slot. */
  verifyModelId?: string;
  /** What replaces the model list (ComfyUI's workflows). */
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const provider = entry.provider;
  const editable = entry.state === 'workspace' || entry.state === 'available';
  const models =
    provider?.capabilities[kind]?.models ?? entry.preset?.capabilities[kind]?.models ?? catalogue;
  const [testLoading, setTestLoading] = useState(false);
  const testInFlight = useRef(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [confirmPaidTest, setConfirmPaidTest] = useState(false);
  const canEditNineRouter = entry.preset?.id === 'antigravity';
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? defaultBaseUrl ?? '');
  const [imageModelsText, setImageModelsText] = useState(
    (provider?.imageModels ?? models.map((model) => model.id)).join(', '),
  );

  useEffect(() => {
    setBaseUrl(provider?.baseUrl ?? defaultBaseUrl ?? '');
    setImageModelsText((provider?.imageModels ?? models.map((model) => model.id)).join(', '));
  }, [provider?.id, provider?.baseUrl, provider?.imageModels, defaultBaseUrl, models]);

  const saveBaseUrl = () => {
    const next = baseUrl.trim();
    if (canEditNineRouter && next !== (provider?.baseUrl ?? defaultBaseUrl ?? '')) {
      void saveServiceProvider(view, apply, entry, { baseUrl: next || null }, t);
    }
  };

  const saveImageModels = () => {
    if (!canEditNineRouter) return;
    const imageModels = [
      ...new Set(
        imageModelsText
          .split(/[\n,]/)
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    ];
    const current = provider?.imageModels ?? models.map((model) => model.id);
    if (JSON.stringify(imageModels) !== JSON.stringify(current)) {
      void saveServiceProvider(
        view,
        apply,
        entry,
        {
          imageModels: imageModels.length ? imageModels : null,
          ...(!provider && baseUrl.trim() ? { baseUrl: baseUrl.trim() } : {}),
        },
        t,
      );
    }
  };

  const success = t(
    kind === 'image' ? 'settings.imageConnectivitySuccess' : 'settings.videoConnectivitySuccess',
  );
  const failed = t(
    kind === 'image' ? 'settings.imageConnectivityFailed' : 'settings.videoConnectivityFailed',
  );

  const handleTest = async () => {
    if (testInFlight.current) return;
    testInFlight.current = true;
    setTestLoading(true);
    setTestStatus('idle');
    setTestMessage('');
    try {
      const data = await verifySavedMedia(kind, entry.id, verifyModelId ?? models[0]?.id);
      if (data.success) {
        setTestStatus('success');
        setTestMessage(success);
      } else {
        setTestStatus('error');
        setTestMessage(`${failed}: ${data.error}`);
      }
    } catch (err) {
      setTestStatus('error');
      setTestMessage(`${failed}: ${err}`);
    } finally {
      testInFlight.current = false;
      setTestLoading(false);
    }
  };

  const startTest = () => {
    if (kind === 'image' && canEditNineRouter) {
      setConfirmPaidTest(true);
      return;
    }
    void handleTest();
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {entry.state === 'deployment' && <ServerConfiguredNotice view={view} capability={kind} />}
      {entry.state === 'server-only' && <ServerOnlyNotice noUserKeys={!view.allowUserKeys} />}

      {editable && (
        <>
          {/* API Key + Test inline */}
          <div className="space-y-2">
            <Label>API Key</Label>
            <ApiKeyField
              name={`${kind}-api-key-${entry.id}`}
              provider={provider}
              onSave={(apiKey) => saveServiceProvider(view, apply, entry, { apiKey }, t)}
              onRemove={() => saveServiceProvider(view, apply, entry, { apiKey: '' }, t)}
            >
              <Button
                variant="outline"
                size="sm"
                onClick={startTest}
                disabled={testLoading || !provider}
                className="gap-1.5"
              >
                {testLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <>
                    <Zap className="h-3.5 w-3.5" />
                    {t('settings.testConnection')}
                  </>
                )}
              </Button>
            </ApiKeyField>
            {testMessage && (
              <div
                className={cn(
                  'rounded-lg p-3 text-sm overflow-hidden',
                  testStatus === 'success' &&
                    'bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/50 dark:text-green-400 dark:border-green-800',
                  testStatus === 'error' &&
                    'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/50 dark:text-red-400 dark:border-red-800',
                )}
              >
                <div className="flex items-start gap-2 min-w-0">
                  {testStatus === 'success' && <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />}
                  {testStatus === 'error' && <XCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                  <p className="flex-1 min-w-0 break-all">{testMessage}</p>
                </div>
              </div>
            )}
          </div>

          {/* Base URL: the service's own endpoint; another one is the server's to set. */}
          <div className="space-y-2">
            <Label>Base URL</Label>
            {defaultBaseUrl && (
              <p className="text-xs text-muted-foreground break-all">
                {t('settings.requestUrl')}: {defaultBaseUrl}
              </p>
            )}
            {canEditNineRouter && editable ? (
              <Input
                aria-label="Base URL"
                type="url"
                value={baseUrl}
                onChange={(event) => setBaseUrl(event.target.value)}
                onBlur={saveBaseUrl}
                placeholder="http://localhost:20128/v1"
                className="font-mono text-sm"
              />
            ) : (
              <EndpointServerOnlyHint />
            )}
          </div>
        </>
      )}

      {children ?? (
        <div className="space-y-3">
          <Label className="text-base">{t('settings.models')}</Label>
          {canEditNineRouter && editable && (
            <div className="space-y-1.5">
              <Input
                aria-label="Image model IDs"
                value={imageModelsText}
                onChange={(event) => setImageModelsText(event.target.value)}
                onBlur={saveImageModels}
                placeholder="ag/gemini-3.1-flash-image"
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Edit the 9Router image model IDs, separated by commas or new lines. The list is
                separate from chat models.
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            {models.map((model) => (
              <div
                key={model.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-card"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm font-medium">{model.name}</div>
                  <div className="text-xs text-muted-foreground font-mono mt-0.5">{model.id}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {kind === 'image' && canEditNineRouter && (
        <AlertDialog open={confirmPaidTest} onOpenChange={setConfirmPaidTest}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('settings.ninerouterPaidTestTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('settings.ninerouterPaidTestDescription')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={testLoading}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                disabled={testLoading}
                onClick={(event) => {
                  event.preventDefault();
                  setConfirmPaidTest(false);
                  void handleTest();
                }}
              >
                {t('settings.ninerouterPaidTestAction')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
