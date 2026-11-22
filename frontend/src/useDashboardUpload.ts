import React, { useState } from 'react';
import axios from 'axios';
import api, { API_ENDPOINTS } from './api';

export interface UseDashboardUploadParams {
  fetchSummary: () => Promise<void>;
}

export function useDashboardUpload({ fetchSummary }: UseDashboardUploadParams) {
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadStatusMsg, setUploadStatusMsg] = useState('');
  const [password, setPassword] = useState('');

  const pollJobStatus = (jobId: string) => {
    setUploadStatusMsg('Processing portfolio... This may take a few minutes.');
    const checkStatus = async () => {
      try {
        const res = await api.get<{ status: string; message?: string }>(`${API_ENDPOINTS.PORTFOLIO}/upload-status/${jobId}`);
        const { status, message } = res.data;
        if (status === 'COMPLETED') {
          setShowUpload(false);
          setPassword('');
          setUploading(false);
          setUploadStatusMsg('');
          await fetchSummary();
        } else if (status === 'FAILED') {
          setUploading(false);
          setUploadStatusMsg('');
          alert(`Processing failed: ${message || 'Unknown error'}`);
        } else {
          setUploadStatusMsg(`Processing... (${status.toLowerCase()})`);
          setTimeout(checkStatus, 3000);
        }
      } catch (err) {
        console.error('Error polling job status:', err);
        setUploading(false);
        setUploadStatusMsg('');
        alert('Lost connection to processing status.');
      }
    };
    setTimeout(checkStatus, 2000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('password', password);
    try {
      setUploading(true);
      setUploadStatusMsg('Uploading file...');
      const res = await api.post<{ jobId?: string }>(`${API_ENDPOINTS.PORTFOLIO}/upload`, formData);
      if (res.status === 202 && res.data.jobId) {
        pollJobStatus(res.data.jobId);
      } else {
        setShowUpload(false);
        setPassword('');
        await fetchSummary();
        setUploading(false);
        setUploadStatusMsg('');
      }
    } catch (err: unknown) {
      setUploading(false);
      setUploadStatusMsg('');
      const errDetail = axios.isAxiosError(err) ? err.response?.data?.error : undefined;
      alert(errDetail || 'Upload failed. Please check your password or file format.');
    }
  };

  return {
    showUpload,
    setShowUpload,
    uploading,
    uploadStatusMsg,
    password,
    setPassword,
    handleFileUpload,
  };
}
