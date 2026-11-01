import { describe, it, expect, beforeEach } from 'vitest';
import type { InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import api from './api';

describe('API client and interceptors', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('attaches authorization bearer token if token is present', async () => {
    localStorage.setItem('token', 'my-test-jwt');
    const reqConfig = { headers: {} } as unknown as InternalAxiosRequestConfig;
    const interceptor = api.interceptors.request as unknown as { handlers: Array<{ fulfilled: (cfg: InternalAxiosRequestConfig) => InternalAxiosRequestConfig }> };
    const result = interceptor.handlers[0].fulfilled(reqConfig);
    expect(result.headers.Authorization).toBe('Bearer my-test-jwt');
  });

  it('leaves authorization header empty if token is missing', async () => {
    const reqConfig = { headers: {} } as unknown as InternalAxiosRequestConfig;
    const interceptor = api.interceptors.request as unknown as { handlers: Array<{ fulfilled: (cfg: InternalAxiosRequestConfig) => InternalAxiosRequestConfig }> };
    const result = interceptor.handlers[0].fulfilled(reqConfig);
    expect(result.headers.Authorization).toBeUndefined();
  });

  it('rejects request error correctly', async () => {
    const testError = new Error('Request error');
    const interceptor = api.interceptors.request as unknown as { handlers: Array<{ rejected: (err: unknown) => Promise<never> }> };
    await expect(interceptor.handlers[0].rejected(testError)).rejects.toThrow('Request error');
  });

  it('handles response and passes through', async () => {
    const res = { status: 200, data: { ok: true } } as unknown as AxiosResponse;
    const interceptor = api.interceptors.response as unknown as { handlers: Array<{ fulfilled: (res: AxiosResponse) => AxiosResponse }> };
    expect(interceptor.handlers[0].fulfilled(res)).toBe(res);
  });

  it('handles 401 error and clears token when not bypassing and not auth route', async () => {
    localStorage.setItem('token', 'expired-token');
    const error = {
      response: { status: 401 },
      config: { url: '/api/portfolio/summary' },
    };
    const interceptor = api.interceptors.response as unknown as { handlers: Array<{ rejected: (err: unknown) => Promise<never> }> };
    await expect(interceptor.handlers[0].rejected(error)).rejects.toEqual(error);
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('ignores 401 on auth login or when bypass-auth is active', async () => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('bypass-auth', 'true');
    const error = {
      response: { status: 401 },
      config: { url: '/api/portfolio/summary' },
    };
    const interceptor = api.interceptors.response as unknown as { handlers: Array<{ rejected: (err: unknown) => Promise<never> }> };
    await expect(interceptor.handlers[0].rejected(error)).rejects.toEqual(error);
    expect(localStorage.getItem('token')).toBe('test-token');
  });
});
