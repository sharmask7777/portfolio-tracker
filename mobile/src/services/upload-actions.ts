import * as DocumentPicker from 'expo-document-picker';
import {
  enqueueCasUpload,
  flushUploadQueue,
  isServerReachable,
} from './upload-queue';
import { getStoredCredentials } from './auth-service';
import { refreshPortfolio } from './portfolio-service';

export interface SelectedFile {
  name: string;
  uri: string;
  size?: number | undefined;
}

export interface StatusMessage {
  type: 'success' | 'warning' | 'error';
  text: string;
}

export async function pickCasDocument(
  onSelect: (f: SelectedFile) => void,
  onError: (msg: string) => void,
): Promise<void> {
  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      const asset = result.assets[0];
      if (asset) {
        onSelect({
          name: asset.name,
          uri: asset.uri,
          size: asset.size,
        });
      }
    }
  } catch {
    onError('Failed to open document picker');
  }
}

export async function submitCasUpload(
  file: SelectedFile,
  password: string,
  onStatus: (msg: StatusMessage) => void,
): Promise<void> {
  await enqueueCasUpload({
    filePath: file.uri,
    fileName: file.name,
    password: password.trim() || null,
  });

  const creds = await getStoredCredentials();
  const reachable = creds.serverUrl
    ? await isServerReachable(creds.serverUrl)
    : false;

  if (reachable && creds.serverUrl && creds.token) {
    const res = await flushUploadQueue(creds.serverUrl, creds.token);
    if (res.succeeded > 0) {
      await refreshPortfolio().catch(() => {});
      onStatus({
        type: 'success',
        text: 'Statement uploaded and processed successfully!',
      });
      return;
    }
    if (res.failed > 0) {
      onStatus({
        type: 'error',
        text: res.errors[0] ?? 'Statement processing failed.',
      });
      return;
    }
  }

  onStatus({
    type: 'warning',
    text: 'Queued for upload when server reconnects',
  });
}

export async function runOutboxSync(
  onStatus: (msg: StatusMessage) => void,
): Promise<void> {
  const creds = await getStoredCredentials();
  if (!creds.serverUrl) {
    onStatus({
      type: 'error',
      text: 'No server paired. Configure server in Settings.',
    });
    return;
  }

  const reachable = await isServerReachable(creds.serverUrl);
  if (!reachable) {
    onStatus({
      type: 'warning',
      text: 'Queued for upload when server reconnects',
    });
    return;
  }

  const res = await flushUploadQueue(creds.serverUrl, creds.token ?? '');
  if (res.succeeded > 0) {
    await refreshPortfolio().catch(() => {});
    onStatus({
      type: 'success',
      text: `Synced ${res.succeeded} statement(s) successfully!`,
    });
    return;
  }

  onStatus({
    type: 'error',
    text: `Sync failed for ${res.failed} item(s).`,
  });
}
