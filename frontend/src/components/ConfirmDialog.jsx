import React, { useEffect, useRef } from 'react'

export default function ConfirmDialog({ state, onDone }) {
  const dlgRef = useRef(null)

  useEffect(() => {
    const dlg = dlgRef.current
    if (!dlg) return
    dlg.showModal()
    const done = (val) => {
      if (dlg.open) dlg.close()
      onDone()
      state.resolve(val)
    }
    const onClick = (e) => {
      if (e.target === dlg) done(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') done(false)
    }
    dlg.addEventListener('click', onClick)
    dlg.addEventListener('keydown', onKey)
    return () => {
      dlg.removeEventListener('click', onClick)
      dlg.removeEventListener('keydown', onKey)
    }
  }, [state, onDone])

  const danger = state.danger

  return (
    <dialog ref={dlgRef} className="confirm-modal">
      <h3>{state.title}</h3>
      <p>{state.message}</p>
      <div className="confirm-actions">
        <button
          type="button"
          className="btn-cancel"
          onClick={() => {
            if (dlgRef.current?.open) dlgRef.current.close()
            onDone()
            state.resolve(false)
          }}
        >
          Batal
        </button>
        <button
          type="button"
          className={danger ? 'btn-danger' : 'btn-save'}
          onClick={() => {
            if (dlgRef.current?.open) dlgRef.current.close()
            onDone()
            state.resolve(true)
          }}
        >
          {state.confirmText || 'Ya'}
        </button>
      </div>
    </dialog>
  )
}
