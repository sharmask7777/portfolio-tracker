import { useState, useEffect, useCallback } from 'react';
import {
  getUploadQueueStatus,
  type UploadQueueStatus,
} from '../services/upload-queue';
import {
  pickCasDocument,
  submitCasUpload,
  runOutboxSync,
  type SelectedFile,
  type StatusMessage,
} from '../services/upload-actions';

export interface UseCasUploadReturn {
  selectedFile: SelectedFile | null;
  setSelectedFile: (file: SelectedFile | null) => void;
  password: string;
  setPassword: (pwd: string) => void;
  isUploading: boolean;
  isSyncing: boolean;
  statusMsg: StatusMessage | null;
  setStatusMsg: (msg: StatusMessage | null) => void;
  queueStatus: UploadQueueStatus | null;
  handlePickDocument: () => Promise<void>;
  handleUpload: () => Promise<void>;
  handleSyncOutbox: () => Promise<void>;
  refreshQueue: () => Promise<void>;
}

function useQueueSyncState(
  setStatusMsg: (msg: StatusMessage | null) => void,
): {
  isSyncing: boolean;
  queueStatus: UploadQueueStatus | null;
  refreshQueue: () => Promise<void>;
  handleSyncOutbox: () => Promise<void>;
} {
  const [isSyncing, setIsSyncing] = useState(false);
  const [queueStatus, setQueueStatus] = useState<UploadQueueStatus | null>(null);

  const refreshQueue = useCallback(async () => {
    const qStatus = await getUploadQueueStatus().catch(() => null);
    if (qStatus) setQueueStatus(qStatus);
  }, []);

  useEffect(() => {
    void refreshQueue();
  }, [refreshQueue]);

  const handleSyncOutbox = useCallback(async () => {
    setIsSyncing(true);
    try {
      await runOutboxSync(setStatusMsg);
    } finally {
      setIsSyncing(false);
      void refreshQueue();
    }
  }, [setStatusMsg, refreshQueue]);

  return { isSyncing, queueStatus, refreshQueue, handleSyncOutbox };
}

export function useCasUpload(): UseCasUploadReturn {
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);
  const [password, setPassword] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<StatusMessage | null>(null);

  const { isSyncing, queueStatus, refreshQueue, handleSyncOutbox } =
    useQueueSyncState(setStatusMsg);

  const handlePickDocument = useCallback(async () => {
    await pickCasDocument(
      (file) => {
        setSelectedFile(file);
        setStatusMsg(null);
      },
      (err) => setStatusMsg({ type: 'error', text: err }),
    );
  }, []);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setStatusMsg(null);
    try {
      await submitCasUpload(selectedFile, password, setStatusMsg);
      setSelectedFile(null);
      setPassword('');
    } catch {
      setStatusMsg({
        type: 'error',
        text: 'Failed to process statement upload',
      });
    } finally {
      setIsUploading(false);
      void refreshQueue();
    }
  }, [selectedFile, password, refreshQueue]);

  return {
    selectedFile,
    setSelectedFile,
    password,
    setPassword,
    isUploading,
    isSyncing,
    statusMsg,
    setStatusMsg,
    queueStatus,
    handlePickDocument,
    handleUpload,
    handleSyncOutbox,
    refreshQueue,
  };
}
