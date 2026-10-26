import { beforeEach, describe, expect, it, vi } from 'vitest';
import { generateWithNineRouterImage } from '@/lib/media/adapters/9router-image-adapter';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

describe('9router image adapter', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('posts the configured model and image dimensions to the local 9Router endpoint', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ data: [{ url: 'https://cdn.example.test/generated.png' }] }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const result = await generateWithNineRouterImage(
      {
        providerId: 'ninerouter-image',
        apiKey: 'local-test-key',
        baseUrl: 'http://localhost:20128/v1/',
        model: 'ag/gemini-3.1-flash-image',
      },
      { prompt: 'a classroom diagram', width: 1536, height: 1024 },
    );

    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:20128/v1/images/generations',
      expect.objectContaining({
        method: 'POST',
        redirect: 'manual',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer local-test-key',
        },
      }),
    );
    expect(JSON.parse(mockFetch.mock.calls[0][1].body)).toEqual({
      model: 'ag/gemini-3.1-flash-image',
      prompt: 'a classroom diagram',
      n: 1,
      size: '1536x1024',
    });
    expect(result).toMatchObject({
      url: 'https://cdn.example.test/generated.png',
      width: 1536,
      height: 1024,
    });
  });

  it('adds the 9Router /v1 prefix when the configured Base URL omits it', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [{ url: 'https://cdn.example.test/image.png' }] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await generateWithNineRouterImage(
      {
        providerId: 'ninerouter-image',
        apiKey: '',
        baseUrl: 'http://localhost:20128',
        model: 'ag/gemini-3.1-flash-image',
      },
      { prompt: 'test' },
    );

    expect(mockFetch.mock.calls[0][0]).toBe(
      'http://localhost:20128/v1/images/generations',
    );
  });

  it('preserves the media type returned with inline base64 image data', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ data: [{ b64_json: '/9j/4AAQ', media_type: 'image/jpeg' }] }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    const result = await generateWithNineRouterImage(
      {
        providerId: 'ninerouter-image',
        apiKey: 'local-test-key',
        baseUrl: 'http://localhost:20128/v1',
        model: 'ag/custom-image-alias',
      },
      { prompt: 'a jpeg' },
    );

    expect(result).toMatchObject({
      url: 'data:image/jpeg;base64,/9j/4AAQ',
      base64: '/9j/4AAQ',
      mimeType: 'image/jpeg',
    });
  });

  it('rejects redirects instead of forwarding the bearer key', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: 'http://127.0.0.1/internal' },
      }),
    );

    await expect(
      generateWithNineRouterImage(
        {
          providerId: 'ninerouter-image',
          apiKey: 'local-test-key',
          baseUrl: 'http://localhost:20128/v1',
          model: 'ag/gemini-3.1-flash-image',
        },
        { prompt: 'test' },
      ),
    ).rejects.toThrow(/redirect/i);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('rejects an empty or malformed image result', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ data: [] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(
      generateWithNineRouterImage(
        {
          providerId: 'ninerouter-image',
          apiKey: '',
          baseUrl: 'http://localhost:20128/v1',
          model: 'ag/gemini-3.1-flash-image',
        },
        { prompt: 'test' },
      ),
    ).rejects.toThrow(/empty image response/i);
  });
});
