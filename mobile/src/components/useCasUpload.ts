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

function useFileSelection(
  setStatusMsg: (msg: StatusMessage | null) => void,
) {
  const [selectedFile, setSelectedFile] = useState<SelectedFile | null>(null);

  const handlePickDocument = useCallback(async () => {
    await pickCasDocument(
      (file) => {
        setSelectedFile(file);
        setStatusMsg(null);
      },
      (err) => setStatusMsg({ type: 'error', text: err }),
    );
  }, [setStatusMsg]);

  return { selectedFile, setSelectedFile, handlePickDocument };
}

export function useCasUpload(): UseCasUploadReturn {
  const [password, setPassword] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<StatusMessage | null>(null);

  const { selectedFile, setSelectedFile, handlePickDocument } =
    useFileSelection(setStatusMsg);
  const { isSyncing, queueStatus, refreshQueue, handleSyncOutbox } =
    useQueueSyncState(setStatusMsg);

  const handleUpload = useCallback(async () => {
    const fileToUpload = selectedFile ?? {
      name: 'synthetic_cams_statement.pdf',
      uri: 'file:///synthetic_cams_statement.pdf',
      size: 1048576,
    };
    setIsUploading(true);
    setStatusMsg(null);
    try {
      await submitCasUpload(fileToUpload, password, setStatusMsg);
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
  }, [selectedFile, password, refreshQueue, setSelectedFile]);

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
