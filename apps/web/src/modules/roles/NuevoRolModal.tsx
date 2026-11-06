import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ALCANCE_LABEL, ROLES, rolCreateSchema, type RolEmpresa } from '@platinum/shared';
import { ApiError, mensajeDeError } from '../../core/api';
import { erroresDeCampos } from '../../core/forms/fieldErrors';
import { Button, FormField, Input, Modal, Select, toast } from '../../components/ui';
import { rolesService } from './roles.service';

export function NuevoRolModal({
  roles,
  onClose,
  onCreado,
}: {
  roles: RolEmpresa[];
  onClose: () => void;
  onCreado: (rol: RolEmpresa) => void;
}) {
  const qc = useQueryClient();
  const porDefecto = roles.find((r) => r.clave === ROLES.COLABORADOR) ?? roles.find((r) => r.clave !== ROLES.ADMIN) ?? roles[0];
  const [nombre, setNombre] = useState('');
  const [aPartirDeId, setAPartirDeId] = useState<string>(porDefecto ? String(porDefecto.id) : '');
  const [errors, setErrors] = useState<{ nombre?: string; aPartirDeId?: string }>({});

  const crear = useMutation({
    mutationFn: () => rolesService.crear({ nombre, aPartirDeId: Number(aPartirDeId) }),
    onSuccess: (nuevo) => {
      void qc.invalidateQueries({ queryKey: rolesService.keys.all });
      toast.success(`Rol "${nuevo.nombre}" creado`);
      onCreado(nuevo);
    },
    onError: (e) => {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length > 0) {
        setErrors(e.fieldErrors);
      } else {
        toast.error(mensajeDeError(e));
      }
    },
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = rolCreateSchema.safeParse({ nombre, aPartirDeId });
    if (!parsed.success) {
      setErrors(erroresDeCampos(parsed.error));
      return;
    }
    crear.mutate();
  };

  const opcionesOrigen = roles
    .filter((r) => r.clave !== ROLES.ADMIN)
    .map((r) => ({
      value: String(r.id),
      label: `${r.nombre} (${ALCANCE_LABEL[r.alcance]} · ${r.permisos.length} permisos)`,
    }));

  const formId = 'nuevo-rol-form';

  return (
    <Modal
      open
      onClose={onClose}
      dismissible={!nombre.trim()}
      title="Nuevo rol"
      description="Se creará copiando el alcance y los permisos del rol que elijas. En el siguiente paso podrás ajustarlos."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} loading={crear.isPending}>
            Crear rol
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={onSubmit} noValidate className="space-y-4">
        <FormField label="Nombre del rol" required error={errors.nombre} hint="Ej. Nómina, Recepción, Coordinador…">
          <Input
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value);
              setErrors((prev) => ({ ...prev, nombre: undefined }));
            }}
            placeholder="Escribe el nombre…"
            autoFocus
            autoComplete="off"
          />
        </FormField>

        <FormField
          label="Copiar permisos y alcance a partir de"
          required
          error={errors.aPartirDeId}
          hint="Empieza con una base parecida para solo prender o apagar lo que cambie."
        >
          <Select
            options={opcionesOrigen}
            value={aPartirDeId}
            onChange={(e) => {
              setAPartirDeId(e.target.value);
              setErrors((prev) => ({ ...prev, aPartirDeId: undefined }));
            }}
          />
        </FormField>
      </form>
    </Modal>
  );
}

