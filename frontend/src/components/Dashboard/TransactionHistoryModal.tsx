import React from 'react';
import { TransactionSidePanel, type PanelFolio } from './TransactionSidePanel';

interface TransactionHistoryModalProps {
  folio: PanelFolio | null;
  onClose: () => void;
  onDeleteFolio: (folio: PanelFolio) => Promise<void>;
}

/**
 * Slide-out transaction ledger history modal wrapper for a selected folio position.
 */
export const TransactionHistoryModal: React.FC<TransactionHistoryModalProps> = ({
  folio,
  onClose,
  onDeleteFolio,
}) => {
  if (!folio) return null;

  return (
    <TransactionSidePanel
      folio={folio}
      onClose={onClose}
      onDeleteFolio={onDeleteFolio}
    />
  );
};
