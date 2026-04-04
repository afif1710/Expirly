import React from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export default function Modal({ isOpen, onClose, title, children }: ModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-[2px] animate-fade-in"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-t-3xl w-full max-w-md p-6 pb-8 animate-slide-up z-10">
        <div className="w-10 h-1 bg-sage-200 rounded-full mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-sage-900 mb-4">{title}</h3>
        {children}
      </div>
    </div>
  )
}
