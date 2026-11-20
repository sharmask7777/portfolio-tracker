import { describe, it, expect } from 'vitest';
import { classifyTransportSecurity } from './transport-security';

describe('classifyTransportSecurity', () => {
  it('classifies HTTPS as SECURE', () => {
    const res = classifyTransportSecurity('https://portfolio.example.com');
    expect(res.level).toBe('SECURE');
    expect(res.isEncrypted).toBe(true);
    expect(res.hostname).toBe('portfolio.example.com');
    expect(res.warningMessage).toBeUndefined();
  });

  it('classifies localhost and 127.0.0.1 as LOCAL_INSECURE', () => {
    const res1 = classifyTransportSecurity('http://localhost:8080');
    expect(res1.level).toBe('LOCAL_INSECURE');
    expect(res1.isEncrypted).toBe(false);

    const res2 = classifyTransportSecurity('http://127.0.0.1:8082');
    expect(res2.level).toBe('LOCAL_INSECURE');

    const res3 = classifyTransportSecurity('http://10.0.2.2:8080');
    expect(res3.level).toBe('LOCAL_INSECURE');
  });

  it('classifies RFC 1918 private IPs as LOCAL_INSECURE', () => {
    // 192.168.x.x
    const res192 = classifyTransportSecurity('http://192.168.1.150:8080');
    expect(res192.level).toBe('LOCAL_INSECURE');

    // 10.x.x.x
    const res10 = classifyTransportSecurity('http://10.0.0.45:3000');
    expect(res10.level).toBe('LOCAL_INSECURE');

    // 172.16-31.x.x
    const res172 = classifyTransportSecurity('http://172.20.1.5:8080');
    expect(res172.level).toBe('LOCAL_INSECURE');

    // Tailscale 100.64-127.x.x
    const resTailscale = classifyTransportSecurity('http://100.80.20.10:8080');
    expect(resTailscale.level).toBe('LOCAL_INSECURE');
  });

  it('classifies local mDNS and LAN domains as LOCAL_INSECURE', () => {
    const resLocal = classifyTransportSecurity('http://raspberrypi.local:8080');
    expect(resLocal.level).toBe('LOCAL_INSECURE');

    const resLan = classifyTransportSecurity('http://server.home.arpa:8080');
    expect(resLan.level).toBe('LOCAL_INSECURE');
  });

  it('flags public cleartext HTTP domains as PUBLIC_INSECURE with high risk warning', () => {
    const resPublic = classifyTransportSecurity('http://myhome.duckdns.org:8080');
    expect(resPublic.level).toBe('PUBLIC_INSECURE');
    expect(resPublic.isEncrypted).toBe(false);
    expect(resPublic.warningMessage).toContain('High Security Risk');

    const resPublicIp = classifyTransportSecurity('http://8.8.8.8:8080');
    expect(resPublicIp.level).toBe('PUBLIC_INSECURE');
  });

  it('handles invalid or unsupported URLs gracefully', () => {
    const invalid = classifyTransportSecurity('not-a-valid-url');
    expect(invalid.level).toBe('PUBLIC_INSECURE');
    expect(invalid.warningMessage).toBe('Invalid URL format');

    const ftp = classifyTransportSecurity('ftp://server.local');
    expect(ftp.level).toBe('PUBLIC_INSECURE');
    expect(ftp.warningMessage).toContain('Unsupported protocol');
  });
});
