import { useState } from 'react';
import { Plus, Pencil, UserX } from 'lucide-react';
import { PageHeader } from '../../components/layout/AppShell';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  DataTable,
  FormField,
  Input,
  Modal,
  Pagination,
  PhotoUploader,
  Select,
  Textarea,
  toast,
  type Column,
} from '../../components/ui';

interface Demo {
  id: number;
  nombre: string;
  email: string;
  rol: string;
  activo: boolean;
}

const rows: Demo[] = [
  { id: 1, nombre: 'Laura Méndez', email: 'laura@platinum.mx', rol: 'Supervisor', activo: true },
  { id: 2, nombre: 'Jorge Ramírez', email: 'jorge@platinum.mx', rol: 'Guardia', activo: true },
  { id: 3, nombre: 'Ana Torres', email: 'ana@cliente.com', rol: 'Cliente', activo: false },
];

const columns: Column<Demo>[] = [
  { key: 'nombre', header: 'Nombre', render: (r) => r.nombre, mobile: 'title' },
  { key: 'email', header: 'Correo', render: (r) => r.email, mobile: 'subtitle' },
  { key: 'rol', header: 'Rol', render: (r) => r.rol },
  {
    key: 'estatus',
    header: 'Estatus',
    render: (r) => <Badge tone={r.activo ? 'success' : 'neutral'}>{r.activo ? 'Activo' : 'Baja'}</Badge>,
  },
];

/** Catálogo visual de la librería UI (F0-06). Solo en desarrollo. */
export function UiShowcasePage() {
  const [open, setOpen] = useState(false);
  const [fotos, setFotos] = useState<File[]>([]);
  const [page, setPage] = useState(1);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Componentes UI"
        subtitle="Librería reutilizable de la intranet"
        actions={
          <Button icon={<Plus className="size-4" />} onClick={() => setOpen(true)}>
            Abrir modal
          </Button>
        }
      />

      <Card>
        <CardHeader title="Botones" />
        <CardBody className="flex flex-wrap gap-2">
          <Button>Primario</Button>
          <Button variant="secondary">Secundario</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Peligro</Button>
          <Button loading>Guardando</Button>
          <Button size="sm" variant="secondary">
            Pequeño
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Badges y avisos" />
        <CardBody className="flex flex-wrap items-center gap-2">
          <Badge>Neutral</Badge>
          <Badge tone="info">Abierto</Badge>
          <Badge tone="warning">En proceso</Badge>
          <Badge tone="success">Resuelto</Badge>
          <Badge tone="danger">Crítica</Badge>
          <Badge tone="brand">Notificado</Badge>
          <Button size="sm" variant="secondary" onClick={() => toast.success('Reporte guardado')}>
            Toast éxito
          </Button>
          <Button size="sm" variant="secondary" onClick={() => toast.error('No se pudo enviar')}>
            Toast error
          </Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Tabla / tarjetas" subtitle="Tabla en escritorio, tarjetas en celular" />
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          onRowClick={(r) => toast.info(`Seleccionado: ${r.nombre}`)}
          actions={() => (
            <>
              <Button size="sm" variant="ghost" aria-label="Editar">
                <Pencil className="size-4" />
              </Button>
              <Button size="sm" variant="ghost" aria-label="Dar de baja">
                <UserX className="size-4" />
              </Button>
            </>
          )}
        />
        <Pagination page={page} limit={3} total={9} onPageChange={setPage} />
      </Card>

      <Card>
        <CardHeader title="Fotos de evidencia" />
        <CardBody>
          <PhotoUploader value={fotos} onChange={setFotos} max={6} />
        </CardBody>
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Nuevo usuario"
        description="Ejemplo de formulario dentro del modal"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                setOpen(false);
                toast.success('Usuario creado');
              }}
            >
              Guardar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <FormField label="Nombre" required>
            <Input placeholder="Nombre completo" />
          </FormField>
          <FormField label="Correo" error="Correo inválido">
            <Input type="email" defaultValue="correo@" />
          </FormField>
          <FormField label="Rol" hint="Define los permisos del usuario">
            <Select
              placeholder="Selecciona un rol"
              options={[
                { value: 'admin', label: 'Administrador' },
                { value: 'supervisor', label: 'Supervisor' },
                { value: 'guardia', label: 'Guardia' },
              ]}
            />
          </FormField>
          <FormField label="Notas">
            <Textarea placeholder="Comentarios" />
          </FormField>
        </div>
      </Modal>
    </div>
  );
}
