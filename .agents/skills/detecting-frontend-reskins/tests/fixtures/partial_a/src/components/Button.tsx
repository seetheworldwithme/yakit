import React from 'react'
export const ActionButton: React.FC<{ label: string; onClick: () => void }> = ({ label, onClick }) => (
  <button className="action-btn" onClick={onClick}>
    {label}
  </button>
)
