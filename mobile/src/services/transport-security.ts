/**
 * Security classifications for server URL transport layer.
 */
export type TransportSecurityLevel = 'SECURE' | 'LOCAL_INSECURE' | 'PUBLIC_INSECURE';

export interface TransportSecurityInfo {
  level: TransportSecurityLevel;
  hostname: string;
  isEncrypted: boolean;
  warningMessage?: string;
}

const LOCAL_DOMAINS = ['.local', '.internal', '.lan', '.home.arpa'];

function isPrivateSubnet(o1: number, o2: number): boolean {
  if (o1 === 10 || (o1 === 192 && o2 === 168)) return true;
  if (o1 === 172 && o2 >= 16 && o2 <= 31) return true;
  if (o1 === 100 && o2 >= 64 && o2 <= 127) return true;
  return false;
}

function isPrivateIpv4(host: string): boolean {
  const parts = host.split('.').map(Number);
  if (parts.length !== 4) return false;
  const [o1, o2, o3, o4] = parts;
  if (
    o1 === undefined ||
    o2 === undefined ||
    o3 === undefined ||
    o4 === undefined ||
    isNaN(o1) ||
    isNaN(o2) ||
    isNaN(o3) ||
    isNaN(o4)
  ) {
    return false;
  }
  return isPrivateSubnet(o1, o2);
}

function isLoopback(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '10.0.2.2';
}

function isLocalInsecure(host: string): boolean {
  if (isLoopback(host)) return true;
  if (LOCAL_DOMAINS.some((suffix) => host.endsWith(suffix))) return true;
  return isPrivateIpv4(host);
}

/**
 * Classifies transport security level of a target server URL.
 */
export function classifyTransportSecurity(rawUrl: string): TransportSecurityInfo {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return { level: 'PUBLIC_INSECURE', hostname: '', isEncrypted: false, warningMessage: 'Invalid URL format' };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (parsed.protocol === 'https:') {
    return { level: 'SECURE', hostname, isEncrypted: true };
  }
  if (parsed.protocol !== 'http:') {
    return {
      level: 'PUBLIC_INSECURE',
      hostname,
      isEncrypted: false,
      warningMessage: 'Unsupported protocol: must be HTTP or HTTPS',
    };
  }

  if (isLocalInsecure(hostname)) {
    return {
      level: 'LOCAL_INSECURE',
      hostname,
      isEncrypted: false,
      warningMessage: 'Local/LAN connection: HTTP traffic unencrypted.',
    };
  }

  return {
    level: 'PUBLIC_INSECURE',
    hostname,
    isEncrypted: false,
    warningMessage: 'High Security Risk: Plain HTTP over public network. Credentials can be intercepted.',
  };
}
