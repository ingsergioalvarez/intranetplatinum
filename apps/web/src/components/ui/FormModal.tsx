import { useId, type FormEvent, type ReactNode } from 'react';
import { Button } from './Button';
import { Modal } from './Modal';

interface FormModalProps {
  title: ReactNode;
  description?: ReactNode;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel: string;
  loading?: boolean;
  /** Con cambios sin guardar no se cierra al tocar fuera. */
  dirty?: boolean;
  /** Deshabilita guardar (p. ej. edición sin cambios). */
  submitDisabled?: boolean;
  /** Sin permiso de edición: solo botón "Cerrar". */
  readOnly?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** Acción secundaria (eliminar, dar de baja): a la izquierda en escritorio, al final en celular. */
  secondaryAction?: ReactNode;
  children: ReactNode;
}

/** Modal con formulario y pie Cancelar / Guardar. En celular es bottom-sheet. */
export function FormModal({
  title,
  description,
  onClose,
  onSubmit,
  submitLabel,
  loading,
  dirty,
  submitDisabled,
  readOnly,
  size,
  secondaryAction,
  children,
}: FormModalProps) {
  const formId = useId();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSubmit();
  };
  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!dirty}
      title={title}
      description={description}
      size={size}
      footer={
        <>
          {secondaryAction && <div className="flex flex-col md:mr-auto md:flex-row">{secondaryAction}</div>}
          <Button variant="secondary" onClick={onClose}>
            {readOnly ? 'Cerrar' : 'Cancelar'}
          </Button>
          {!readOnly && (
            <Button type="submit" form={formId} loading={loading} disabled={submitDisabled}>
              {submitLabel}
            </Button>
          )}
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        <fieldset disabled={readOnly} className="space-y-4">
          {children}
        </fieldset>
      </form>
    </Modal>
  );
}
