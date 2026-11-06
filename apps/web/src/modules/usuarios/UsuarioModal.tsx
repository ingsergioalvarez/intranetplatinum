import { useMemo, useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, KeyRound, Trash2, UserCheck, UserX } from 'lucide-react';
import {
  CATALOGO_PERMISOS,
  GRUPOS_PERMISOS,
  PERMISOS,
  PERMISOS_POR_ROL,
  ROL_DESCRIPCIONES,
  ROLES,
  usuarioCreateSchema,
  type Permiso,
  type Rol,
  type Usuario,
  type UsuarioConPassword,
  type UsuarioCreate,
} from '@platinum/shared';
import { ApiError } from '../../core/api';
import { hasPermission, useAuthStore } from '../../core/auth/authStore';
import { erroresDeCampos } from '../../core/forms/fieldErrors';
import { formatFechaHora } from '../../core/format/fechas';
import { Badge, Button, Checkbox, ConfirmDialog, FormField, Input, Modal, Select, toast } from '../../components/ui';
import { EliminarUsuarioDialog } from './EliminarUsuarioDialog';
import { estadoUsuario } from './estadoUsuario';
import { areasService } from '../areas/areas.service';
import { rolesService } from '../roles/roles.service';
import { usuariosService } from './usuarios.service';

interface Campos {
  nombre: string;
  email: string;
  telefono: string;
  telefonoPersonal: string;
  rol: string;
}
type FieldErrors = Partial<Record<keyof Campos, string>>;
type Accion = 'baja' | 'reactivar' | 'reset';

const rolesBaseOpciones = (Object.values(ROLES) as Rol[]).map((r) => ({ value: r, label: ROL_DESCRIPCIONES[r] }));

const mensajeError = (e: unknown) => (e instanceof ApiError ? e.message : 'Ocurrió un error inesperado');

/**
 * Alta / edición de usuario, asignación de rol de la empresa, área y permisos adicionales por persona (C-11 parte 5).
 * `usuario = null` es alta. Se monta con `key` por usuario para reiniciar el formulario.
 */
export function UsuarioModal({
  usuario,
  onClose,
  onPasswordTemporal,
}: {
  usuario: Usuario | null;
  onClose: () => void;
  onPasswordTemporal: (resultado: UsuarioConPassword, titulo: string) => void;
}) {
  const qc = useQueryClient();
  const yo = useAuthStore((s) => s.user);
  const esNuevo = usuario === null;
  const esYo = usuario?.id === yo?.id;
  const deBaja = !!usuario?.deletedAt;
  const puedeEditar =
    hasPermission(yo, esNuevo ? PERMISOS.USUARIOS_CREAR : PERMISOS.USUARIOS_EDITAR) && !deBaja;
  const puedeBaja = hasPermission(yo, PERMISOS.USUARIOS_BAJA) && !esYo && !esNuevo;
  const puedeReset = hasPermission(yo, PERMISOS.USUARIOS_EDITAR) && !esYo && !esNuevo && !deBaja;
  const puedeAdministrarRoles = hasPermission(yo, PERMISOS.ROLES_ADMINISTRAR) && !deBaja;
  // Eliminar definitivamente: solo el rol admin (no el supervisor), para limpiar cuentas de prueba.
  const puedeEliminar = yo?.rol === ROLES.ADMIN && !esYo && !esNuevo;
  const [eliminando, setEliminando] = useState(false);

  const inicial: Campos = {
    nombre: usuario?.nombre ?? '',
    email: usuario?.email ?? '',
    telefono: usuario?.telefono ?? '',
    telefonoPersonal: usuario?.telefonoPersonal ?? '',
    rol: usuario?.rol ?? '',
  };
  const [form, setForm] = useState<Campos>(inicial);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [confirmar, setConfirmar] = useState<Accion | null>(null);
  const esSuper = !!yo?.esSuperAdmin;

  // Roles de la empresa (C-11 parte 5).
  const rolesQuery = useQuery({
    queryKey: rolesService.keys.list(),
    queryFn: () => rolesService.list(),
    enabled: hasPermission(yo, PERMISOS.ROLES_ADMINISTRAR),
  });

  const opcionesTodas = useMemo(() => {
    if (rolesQuery.data && rolesQuery.data.length > 0) {
      return rolesQuery.data.map((r) => ({ value: r.clave, label: r.nombre }));
    }
    const base = [...rolesBaseOpciones];
    if (usuario?.rol && !base.some((b) => b.value === usuario.rol)) {
      base.push({ value: usuario.rol, label: usuario.rolNombre ?? usuario.rol });
    }
    return base;
  }, [rolesQuery.data, usuario?.rol, usuario?.rolNombre]);

  // Solo el super admin crea o cambia administradores (A-65).
  const rolOptions = opcionesTodas.filter(
    (r) => r.value !== ROLES.ADMIN || esSuper || usuario?.rol === ROLES.ADMIN,
  );

  // Permisos que ya incluye el rol seleccionado (para indicarlo en la lista de permisos adicionales).
  const permisosDelRol = useMemo(() => {
    if (!form.rol) return new Set<Permiso>();
    const enLista = rolesQuery.data?.find((r) => r.clave === form.rol);
    if (enLista) return new Set<Permiso>(enLista.permisos);
    const porDefecto = PERMISOS_POR_ROL[form.rol as Rol];
    return new Set<Permiso>(porDefecto ?? []);
  }, [form.rol, rolesQuery.data]);

  const rolSeleccionadoNombre =
    opcionesTodas.find((r) => r.value === form.rol)?.label ?? form.rol;

  // Permisos individuales adicionales (C-11 parte 5).
  const permisosIniciales = useMemo(
    () => [...(usuario?.permisosPropios ?? [])].sort(),
    [usuario?.permisosPropios],
  );
  const [permisosPropios, setPermisosPropios] = useState<Set<Permiso>>(
    () => new Set(permisosIniciales),
  );
  const [verOtrosPermisos, setVerOtrosPermisos] = useState(false);

  const permisosActualesLista = useMemo(
    () => [...permisosPropios].sort(),
    [permisosPropios],
  );
  const cambianPermisos =
    puedeAdministrarRoles &&
    (permisosActualesLista.length !== permisosIniciales.length ||
      permisosActualesLista.some((p, i) => p !== permisosIniciales[i]));

  // Área (C-10): una por persona. La elige el admin de la empresa y se guarda por la API de áreas, después del usuario.
  const puedeElegirArea = hasPermission(yo, PERMISOS.AREAS_ADMINISTRAR);
  const areaInicial = usuario?.areaId != null ? String(usuario.areaId) : '';
  const [areaId, setAreaId] = useState(areaInicial);
  const areas = useQuery({
    queryKey: areasService.keys.list('activas'),
    queryFn: () => areasService.list('activas'),
    enabled: puedeElegirArea,
  });
  const cambiaArea = puedeElegirArea && areaId !== areaInicial;
  const cambianDatos = (Object.keys(inicial) as (keyof Campos)[]).some((k) => form[k] !== inicial[k]);
  const cambiado = cambiaArea || cambianPermisos || cambianDatos;

  const refrescar = () => qc.invalidateQueries({ queryKey: usuariosService.keys.all });

  const guardar = useMutation({
    mutationFn: async (data: UsuarioCreate): Promise<UsuarioConPassword | Usuario> => {
      let guardado: UsuarioConPassword | Usuario;
      if (esNuevo) {
        guardado = await usuariosService.crear(data);
      } else if (cambianDatos) {
        guardado = await usuariosService.update(usuario.id, data);
      } else {
        guardado = usuario;
      }
      const id = 'usuario' in guardado ? guardado.usuario.id : guardado.id;
      if (cambiaArea) {
        await areasService.asignar(id, areaId ? Number(areaId) : null);
      }
      if (cambianPermisos && data.rol !== ROLES.ADMIN) {
        const actualizadoConPermisos = await usuariosService.fijarPermisos(id, [...permisosPropios]);
        if ('usuario' in guardado) {
          guardado = { ...guardado, usuario: actualizadoConPermisos };
        } else {
          guardado = actualizadoConPermisos;
        }
      }
      return guardado;
    },
    onSuccess: (res) => {
      void refrescar();
      void qc.invalidateQueries({ queryKey: rolesService.keys.all });
      if (cambiaArea) void qc.invalidateQueries({ queryKey: areasService.keys.all });
      onClose();
      if (esNuevo) onPasswordTemporal(res as UsuarioConPassword, 'Usuario creado');
      else toast.success('Cambios guardados');
    },
    onError: (e) => {
      const campos = e instanceof ApiError ? e.fieldErrors : {};
      if (Object.keys(campos).length) setFieldErrors(campos);
      else toast.error(mensajeError(e));
    },
  });

  const accion = useMutation({
    mutationFn: async (a: Accion) => {
      if (a === 'reset') return usuariosService.resetPassword(usuario!.id);
      await (a === 'baja' ? usuariosService.deactivate(usuario!.id) : usuariosService.restore(usuario!.id));
      return null;
    },
    onSuccess: (res, a) => {
      void refrescar();
      void qc.invalidateQueries({ queryKey: rolesService.keys.all });
      setConfirmar(null);
      onClose();
      if (res) onPasswordTemporal(res, 'Contraseña restablecida');
      else toast.success(a === 'baja' ? 'Usuario dado de baja' : 'Usuario reactivado');
    },
    onError: (e) => {
      setConfirmar(null);
      toast.error(mensajeError(e));
    },
  });

  const onChange = (campo: keyof Campos) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm((f) => ({ ...f, [campo]: e.target.value }));
    setFieldErrors((errs) => ({ ...errs, [campo]: undefined }));
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = usuarioCreateSchema.safeParse(form);
    if (!parsed.success) return setFieldErrors(erroresDeCampos(parsed.error));
    guardar.mutate(parsed.data);
  };

  // Atajo RH (Decisión 3): activa/desactiva emergencias.recibir + emergencias.atender en un solo paso.
  const esRhActivo = permisosPropios.has(PERMISOS.EMERGENCIAS_RECIBIR);
  const alternarRh = () => {
    setPermisosPropios((prev) => {
      const copia = new Set(prev);
      if (copia.has(PERMISOS.EMERGENCIAS_RECIBIR)) {
        copia.delete(PERMISOS.EMERGENCIAS_RECIBIR);
        copia.delete(PERMISOS.EMERGENCIAS_ATENDER);
      } else {
        copia.add(PERMISOS.EMERGENCIAS_RECIBIR);
        copia.add(PERMISOS.EMERGENCIAS_ATENDER);
      }
      return copia;
    });
  };

  const alternarPermisoIndividual = (clave: Permiso) => {
    setPermisosPropios((prev) => {
      const copia = new Set(prev);
      if (copia.has(clave)) copia.delete(clave);
      else copia.add(clave);
      return copia;
    });
  };

  // Catálogo para el desplegable "Otros permisos individuales" (sin roles.administrar ni los 2 atajos superiores).
  const otrosCatalogo = useMemo(
    () =>
      CATALOGO_PERMISOS.filter(
        (p) =>
          p.clave !== PERMISOS.ROLES_ADMINISTRAR &&
          p.clave !== PERMISOS.EMERGENCIAS_RECIBIR &&
          p.clave !== PERMISOS.ALCANCE_EMPRESA,
      ),
    [],
  );

  const otrosIndividualesActivos = otrosCatalogo.filter((p) => permisosPropios.has(p.clave)).length;

  const estado = usuario && estadoUsuario(usuario);
  const formId = 'usuario-form';
  const puedeGuardarModal = puedeEditar || puedeAdministrarRoles;

  return (
    <>
      <Modal
        open
        onClose={onClose}
        dismissible={!cambiado}
        title={esNuevo ? 'Nuevo usuario' : usuario.nombre}
        description={
          esNuevo
            ? 'Se generará una contraseña temporal para su primer acceso.'
            : esYo
              ? 'Tu cuenta'
              : usuario.email
        }
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              {puedeGuardarModal ? 'Cancelar' : 'Cerrar'}
            </Button>
            {puedeGuardarModal && (
              <Button
                type="submit"
                form={formId}
                loading={guardar.isPending}
                disabled={!esNuevo && !cambiado}
              >
                {esNuevo ? 'Crear usuario' : 'Guardar cambios'}
              </Button>
            )}
          </>
        }
      >
        <form id={formId} onSubmit={onSubmit} noValidate className="space-y-4">
          <FormField label="Nombre completo" required error={fieldErrors.nombre}>
            <Input
              value={form.nombre}
              onChange={onChange('nombre')}
              autoComplete="off"
              disabled={!puedeEditar}
              autoFocus={esNuevo}
            />
          </FormField>
          <FormField label="Correo" required error={fieldErrors.email}>
            <Input
              type="email"
              inputMode="email"
              autoCapitalize="none"
              autoComplete="off"
              value={form.email}
              onChange={onChange('email')}
              disabled={!puedeEditar}
            />
          </FormField>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              label="Teléfono de contacto"
              required={
                form.rol === ROLES.COLABORADOR ||
                form.rol === ROLES.SUPERVISOR ||
                form.rol === ROLES.JEFE
              }
              error={fieldErrors.telefono}
              hint="Puede ser el de la empresa."
            >
              <Input
                type="tel"
                inputMode="tel"
                autoComplete="off"
                value={form.telefono}
                onChange={onChange('telefono')}
                disabled={!puedeEditar}
              />
            </FormField>
            <FormField
              label="Rol"
              required
              error={fieldErrors.rol}
              hint={esYo && puedeEditar ? 'No puedes cambiar tu propio rol.' : undefined}
            >
              <Select
                options={rolOptions}
                placeholder="Selecciona…"
                value={form.rol}
                onChange={onChange('rol')}
                disabled={!puedeEditar || esYo}
              />
            </FormField>
          </div>
          {puedeElegirArea && (
            <FormField label="Área" hint="Una persona pertenece a una sola área. Las áreas se crean en el menú Áreas.">
              <Select
                options={[
                  { value: '', label: 'Sin área' },
                  ...(areas.data ?? []).map((a) => ({ value: String(a.id), label: a.nombreCompleto })),
                ]}
                value={areaId}
                onChange={(e) => setAreaId(e.target.value)}
                disabled={!puedeEditar}
              />
            </FormField>
          )}
          <FormField
            label="Teléfono personal (opcional)"
            error={fieldErrors.telefonoPersonal}
            hint="Si lo tiene, es el que se marca primero en una emergencia."
          >
            <Input
              type="tel"
              inputMode="tel"
              autoComplete="off"
              value={form.telefonoPersonal}
              onChange={onChange('telefonoPersonal')}
              disabled={!puedeEditar}
            />
          </FormField>

          {puedeAdministrarRoles && form.rol !== ROLES.ADMIN && !usuario?.esSuperAdmin && (
            <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-2">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  Permisos adicionales (solo para esta persona)
                </h3>
                <p className="text-xs text-slate-500">
                  Se suman a los de su rol ({rolSeleccionadoNombre || 'sin elegir'}).
                </p>
              </div>

              <div className="divide-y divide-slate-200/70">
                <Checkbox
                  label="Recibe y atiende las emergencias de la empresa (RH)"
                  description="Recibe las alertas SOS de toda la empresa y puede atenderlas y cerrarlas."
                  checked={esRhActivo || (permisosDelRol.has(PERMISOS.EMERGENCIAS_RECIBIR) && permisosDelRol.has(PERMISOS.EMERGENCIAS_ATENDER))}
                  disabled={permisosDelRol.has(PERMISOS.EMERGENCIAS_RECIBIR) && permisosDelRol.has(PERMISOS.EMERGENCIAS_ATENDER)}
                  onChange={alternarRh}
                />

                <Checkbox
                  label="Ver a todas las personas de la empresa"
                  description="Amplía su alcance a toda la empresa, sin importar el área a la que pertenezca."
                  checked={permisosPropios.has(PERMISOS.ALCANCE_EMPRESA) || permisosDelRol.has(PERMISOS.ALCANCE_EMPRESA)}
                  disabled={permisosDelRol.has(PERMISOS.ALCANCE_EMPRESA)}
                  onChange={() => alternarPermisoIndividual(PERMISOS.ALCANCE_EMPRESA)}
                />
              </div>

              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setVerOtrosPermisos((v) => !v)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:text-brand-800"
                >
                  {verOtrosPermisos ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                  <span>
                    Otros permisos individuales
                    {otrosIndividualesActivos > 0 ? ` (${otrosIndividualesActivos} activos)` : ''}
                  </span>
                </button>

                {verOtrosPermisos && (
                  <div className="mt-2 max-h-60 space-y-3 overflow-y-auto rounded-lg border border-slate-200 bg-white p-3">
                    {GRUPOS_PERMISOS.map((grupo) => {
                      const items = otrosCatalogo.filter((p) => p.grupo === grupo.clave);
                      if (items.length === 0) return null;
                      return (
                        <div key={grupo.clave} className="space-y-1">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            {grupo.nombre}
                          </p>
                          <div className="divide-y divide-slate-100">
                            {items.map((p) => {
                              const enSuRol = permisosDelRol.has(p.clave);
                              const marcado = enSuRol || permisosPropios.has(p.clave);
                              return (
                                <Checkbox
                                  key={p.clave}
                                  label={
                                    <span className="inline-flex flex-wrap items-center gap-1.5">
                                      <span>{p.descripcion}</span>
                                      {enSuRol && <Badge tone="neutral">Por su rol</Badge>}
                                    </span>
                                  }
                                  checked={marcado}
                                  disabled={enSuRol}
                                  onChange={() => alternarPermisoIndividual(p.clave)}
                                />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          )}
        </form>

        {usuario && (
          <section className="mt-6 border-t border-slate-100 pt-4">
            <h3 className="text-sm font-semibold text-slate-900">Cuenta</h3>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Estado</dt>
                <dd className="mt-0.5">{estado && <Badge tone={estado.tone}>{estado.label}</Badge>}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Último acceso</dt>
                <dd className="text-slate-800">{formatFechaHora(usuario.ultimoAcceso)}</dd>
              </div>
              {deBaja && (
                <div>
                  <dt className="text-xs text-slate-500">Dado de baja</dt>
                  <dd className="text-slate-800">{formatFechaHora(usuario.deletedAt)}</dd>
                </div>
              )}
            </dl>

            {(puedeReset || puedeBaja || puedeEliminar) && (
              <div className="mt-4 flex flex-col gap-2 md:flex-row">
                {puedeReset && (
                  <Button
                    variant="secondary"
                    icon={<KeyRound className="size-4" />}
                    onClick={() => setConfirmar('reset')}
                  >
                    Restablecer contraseña
                  </Button>
                )}
                {puedeBaja &&
                  (deBaja ? (
                    <Button
                      variant="secondary"
                      icon={<UserCheck className="size-4" />}
                      onClick={() => setConfirmar('reactivar')}
                    >
                      Reactivar
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      className="text-red-700 hover:bg-red-50"
                      icon={<UserX className="size-4" />}
                      onClick={() => setConfirmar('baja')}
                    >
                      Dar de baja
                    </Button>
                  ))}
                {puedeEliminar && (
                  <Button
                    variant="ghost"
                    className="text-red-700 hover:bg-red-50"
                    icon={<Trash2 className="size-4" />}
                    onClick={() => setEliminando(true)}
                  >
                    Eliminar definitivamente
                  </Button>
                )}
              </div>
            )}
          </section>
        )}
      </Modal>

      {usuario && eliminando && (
        <EliminarUsuarioDialog
          usuario={usuario}
          onCancel={() => setEliminando(false)}
          onEliminado={() => {
            void refrescar();
            onClose();
          }}
        />
      )}

      {usuario && (
        <ConfirmDialog
          open={confirmar !== null}
          loading={accion.isPending}
          onCancel={() => setConfirmar(null)}
          onConfirm={() => confirmar && accion.mutate(confirmar)}
          {...textosConfirmacion(confirmar, usuario.nombre)}
        />
      )}
    </>
  );
}

function textosConfirmacion(accion: Accion | null, nombre: string) {
  switch (accion) {
    case 'baja':
      return {
        title: 'Dar de baja',
        confirmLabel: 'Dar de baja',
        variant: 'danger' as const,
        description: `${nombre} ya no podrá entrar y se cerrarán sus sesiones abiertas. Podrás reactivarlo después.`,
      };
    case 'reactivar':
      return {
        title: 'Reactivar usuario',
        confirmLabel: 'Reactivar',
        description: `${nombre} podrá volver a entrar con su contraseña actual.`,
      };
    default:
      return {
        title: 'Restablecer contraseña',
        confirmLabel: 'Generar contraseña',
        description: `Se generará una contraseña temporal para ${nombre}, se cerrarán sus sesiones y deberá cambiarla al entrar. También desbloquea la cuenta si estaba bloqueada.`,
      };
  }
}
