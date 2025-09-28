import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, api, query, setSessionExpiredHandler, tokenStore } from './api';

/**
 * The client is the single place the API is reached from, so its error handling
 * decides what every screen sees. The legacy code called fetch at roughly thirty
 * sites with no shared handling at all.
 */

const originalFetch = globalThis.fetch;

function mockResponse(status: number, body: unknown, contentType = 'application/json') {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': contentType },
  });
}

beforeEach(() => {
  localStorage.clear();
  setSessionExpiredHandler(() => undefined);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe('request handling', () => {
  it('attaches the stored token', async () => {
    tokenStore.set('a-token');
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(200, { ok: true }));
    globalThis.fetch = fetchMock;

    await api.get('/api/v1/reports');

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.headers.Authorization).toBe('Bearer a-token');
  });

  it('sends no authorization header when there is no token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(200, {}));
    globalThis.fetch = fetchMock;

    await api.get('/api/v1/health');

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('leaves Content-Type unset for multipart so the boundary is added', async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(201, {}));
    globalThis.fetch = fetchMock;

    const form = new FormData();
    form.append('templateId', 'x');
    await api.postForm('/api/v1/reports', form);

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init.headers['Content-Type']).toBeUndefined();
  });
});

describe('error handling', () => {
  it('turns the error envelope into a typed ApiError', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      mockResponse(400, {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Request validation failed',
          details: [{ path: 'templateData.summary', message: 'Too short' }],
        },
      })
    );

    await expect(api.post('/api/v1/reports', {})).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_FAILED',
    });
  });

  it('exposes field errors keyed by path for a form to consume', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      mockResponse(400, {
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Request validation failed',
          details: [
            { path: 'email', message: 'Use your work address' },
            { path: 'password', message: 'Too short' },
          ],
        },
      })
    );

    try {
      await api.post('/api/v1/auth/register', {});
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).fieldErrors()).toEqual({
        email: 'Use your work address',
        password: 'Too short',
      });
    }
  });

  it('carries meta through, so a rejection reason can be shown', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      mockResponse(403, {
        error: {
          code: 'ACCOUNT_REJECTED',
          message: 'Your registration was not approved.',
          meta: { rejectionReason: 'Not a current employee' },
        },
      })
    );

    try {
      await api.post('/api/v1/auth/login', {});
      expect.unreachable('should have thrown');
    } catch (error) {
      expect((error as ApiError).meta.rejectionReason).toBe('Not a current employee');
    }
  });

  it('clears the token and notifies when the session is no longer usable', async () => {
    tokenStore.set('expired-token');
    const onExpired = vi.fn();
    setSessionExpiredHandler(onExpired);

    globalThis.fetch = vi.fn().mockResolvedValue(
      mockResponse(401, { error: { code: 'TOKEN_EXPIRED', message: 'Token has expired' } })
    );

    await expect(api.get('/api/v1/reports')).rejects.toBeInstanceOf(ApiError);

    // Without this the whole interface stays up while every request fails.
    expect(tokenStore.get()).toBeNull();
    expect(onExpired).toHaveBeenCalledOnce();
  });

  it('keeps the token when the failure is a refused action rather than a dead session', async () => {
    tokenStore.set('valid-token');
    globalThis.fetch = vi.fn().mockResolvedValue(
      mockResponse(403, { error: { code: 'FORBIDDEN', message: 'Manager role required' } })
    );

    await expect(api.get('/api/v1/analytics/overview')).rejects.toBeInstanceOf(ApiError);
    expect(tokenStore.get()).toBe('valid-token');
  });

  it('still throws an ApiError when the body is not the expected envelope', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(mockResponse(502, '<html>Bad gateway</html>', 'text/html'));

    await expect(api.get('/api/v1/reports')).rejects.toMatchObject({
      status: 502,
      code: 'UNKNOWN',
    });
  });
});

describe('query', () => {
  it('omits empty values so the URL stays clean', () => {
    expect(
      query({ page: 1, reviewStatus: undefined, templateId: '', isoWeek: 32, sort: null })
    ).toBe('?page=1&isoWeek=32');
  });

  it('returns an empty string when nothing is set', () => {
    expect(query({ page: undefined })).toBe('');
  });

  it('keeps a false value, which is a real filter', () => {
    expect(query({ isActive: false })).toBe('?isActive=false');
  });
});
