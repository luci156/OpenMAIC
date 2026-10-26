/**
 * 9Router image generation adapter.
 *
 * 9Router exposes an OpenAI Images-compatible endpoint at
 * `/v1/images/generations` and accepts model IDs from its image router.
 */
import type {
  ImageGenerationConfig,
  ImageGenerationOptions,
  ImageGenerationResult,
} from '../types';
import { mediaFetchFor } from '../media-fetch';
import { assertNotRedirected } from '../redirect-guard';
import { requireModel } from '../require-model';

const DEFAULT_MODEL = 'ag/gemini-3.1-flash-image';
const JPEG_BASE64_PREFIX = '/9j/';

interface NineRouterImageResponse {
  data?: Array<{
    url?: string;
    b64_json?: string;
    media_type?: string;
  }>;
  error?: { message?: string; code?: string | number };
}

/**
 * Accept an API root with or without `/v1`, or the full image endpoint, and
 * produce the single API root to which the adapter appends the image route.
 */
export function normalizeNineRouterImageBaseUrl(baseUrl?: string): string {
  let root = baseUrl?.trim().replace(/\/+$/, '') ?? '';
  if (!root) throw new Error('9Router Image Base URL is required');

  root = root.replace(/\/images\/generations$/i, '');
  if (!/\/v1$/i.test(root)) root += '/v1';
  return root;
}

function imageMimeType(image: { media_type?: string; b64_json?: string }): string {
  const reported = image.media_type?.trim();
  if (reported && /^image\/[a-z0-9.+-]+$/i.test(reported)) return reported;
  return image.b64_json?.startsWith(JPEG_BASE64_PREFIX) ? 'image/jpeg' : 'image/png';
}

export async function generateWithNineRouterImage(
  config: ImageGenerationConfig,
  options: ImageGenerationOptions,
): Promise<ImageGenerationResult> {
  const baseUrl = normalizeNineRouterImageBaseUrl(config.baseUrl);
  const model = requireModel(config.model || DEFAULT_MODEL, '9Router Image');
  const width = options.width || 1024;
  const height = options.height || 1024;

  const response = await mediaFetchFor(config)(`${baseUrl}/images/generations`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/json',
      ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model,
      prompt: options.prompt,
      n: 1,
      size: `${width}x${height}`,
    }),
    ...(options.signal ? { signal: options.signal } : {}),
  });

  assertNotRedirected(response, '9Router Image');

  if (!response.ok) {
    const text = await response.text().catch(() => response.statusText);
    throw new Error(`9Router image generation failed (${response.status}): ${text}`);
  }

  let data: NineRouterImageResponse;
  try {
    data = await response.json();
  } catch {
    throw new Error('9Router returned an invalid image response');
  }
  if (data.error) {
    throw new Error(
      `9Router image error: ${data.error.code ?? ''} ${data.error.message ?? ''}`.trim(),
    );
  }

  const image = data.data?.[0];
  if (image?.url) return { url: image.url, width, height };
  if (image?.b64_json) {
    const mimeType = imageMimeType(image);
    return {
      url: `data:${mimeType};base64,${image.b64_json}`,
      base64: image.b64_json,
      mimeType,
      width,
      height,
    };
  }

  throw new Error('9Router returned an empty image response');
}
