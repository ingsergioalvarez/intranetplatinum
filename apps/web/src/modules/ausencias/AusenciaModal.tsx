import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TriangleAlert } from 'lucide-react';
import {
  COMPROBANTE_AUSENCIA,
  DIAS_MAX_AUSENCIA,
  ROLES,
  TIPOS_AUSENCIA,
  TIPO_AUSENCIA_LABEL,
  ausenciaCreateSchema,
  type TipoAusencia,
  PERMISOS,
} from '@platinum/shared';
import { FormField, FormModal, Input, PhotoUploader, Select, Textarea, toast } from '../../components/ui';
import { ApiError, mensajeDeError } from '../../core/api';
import { useAuthStore, hasPermission } from '../../core/auth/authStore';
import { erroresDeCampos } from '../../core/forms/fieldErrors';
import { hoyLocal } from '../../core/format/fechas';
import { informesService } from '../informes/informes.service';
import { ausenciasService } from './ausencias.service';

/**
 * Pedir o registrar una ausencia justificada (A-43). El guardia pide la suya; el supervisor, la de un guardia
 * suyo (queda por aprobar); el admin la registra y queda aprobada. Lo médico exige foto del comprobante.
 */
export function AusenciaModal({ onClose }: { onClose: () => void }) {
  const user = useAuthStore((s) => s.user)!;
  const esGuardia = user.rol === ROLES.COLABORADOR;
  const puedeResolver = hasPermission(user, PERMISOS.AUSENCIAS_RESOLVER);
  const qc = useQueryClient();
  const hoy = hoyLocal();
  const [usuarioId, setUsuarioId] = useState('');
  const [tipo, setTipo] = useState<TipoAusencia | ''>('');
  const [desde, setDesde] = useState(hoy);
  const [hasta, setHasta] = useState(hoy);
  const [motivo, setMotivo] = useState('');
  const [fotos, setFotos] = useState<File[]>([]);
  const [errores, setErrores] = useState<Partial<Record<string, string>>>({});

  const opciones = useQuery({ queryKey: informesService.keys.opciones, queryFn: informesService.opciones, enabled: !esGuardia });
  const regla = tipo ? COMPROBANTE_AUSENCIA[tipo] : 'no';

  // Antes de guardar, el admin ve cuántas faltas de esos días se justificarían solas.
  const fechasValidas = !!desde && !!hasta && hasta >= desde;
  const previa = useQuery({
    queryKey: ausenciasService.keys.previa(Number(usuarioId), desde, hasta),
    queryFn: () => ausenciasService.vistaPrevia(Number(usuarioId), desde, hasta),
    enabled: puedeResolver && !!usuarioId && fechasValidas,
  });

  const guardar = useMutation({
    mutationFn: () =>
      ausenciasService.crear(
        { ...(esGuardia ? {} : { usuarioId }), tipo: tipo as TipoAusencia, desde, hasta, motivo: motivo.trim() || undefined },
        fotos[0],
      ),
    onSuccess: (a) => {
      void qc.invalidateQueries({ queryKey: ausenciasService.keys.all });
      void qc.invalidateQueries({ queryKey: ['asistencia'] });
      void qc.invalidateQueries({ queryKey: ['cobertura'] });
      void qc.invalidateQueries({ queryKey: ['avisos'] });
      toast.success(
        a.estado === 'aprobada'
          ? 'Ausencia registrada y aprobada'
          : 'Solicitud enviada: el administrador la revisará y te avisamos',
      );
      onClose();
    },
    onError: (e) => {
      if (e instanceof ApiError && Object.keys(e.fieldErrors).length) setErrores(e.fieldErrors);
      else toast.error(mensajeDeError(e));
    },
  });

  const onSubmit = () => {
    const r = ausenciaCreateSchema.safeParse({
      usuarioId: usuarioId || undefined,
      tipo: tipo || undefined,
      desde,
      hasta,
      motivo: motivo.trim() || undefined,
    });
    const nuevos: Partial<Record<string, string>> = r.success ? {} : erroresDeCampos(r.error);
    if (!esGuardia && !usuarioId) nuevos.usuarioId = 'Elige el guardia';
    if (regla === 'obligatorio' && fotos.length === 0) nuevos.foto = 'Adjunta la foto del comprobante';
    setErrores(nuevos);
    if (Object.keys(nuevos).length) return;
    guardar.mutate();
  };

  return (
    <FormModal
      title={puedeResolver ? 'Registrar ausencia' : esGuardia ? 'Pedir una ausencia' : 'Pedir una ausencia para un guardia'}
      description={
        puedeResolver
          ? 'Queda aprobada al guardarla.'
          : 'La resuelve el administrador: te avisamos cuando la apruebe o la rechace.'
      }
      onClose={onClose}
      onSubmit={onSubmit}
      submitLabel={puedeResolver ? 'Registrar' : 'Enviar solicitud'}
      loading={guardar.isPending}
      dirty={!!tipo || !!motivo || fotos.length > 0 || !!usuarioId}
      size="md"
    >
      {!esGuardia && (
        <FormField label="Guardia" required error={errores.usuarioId}>
          <Select
            value={usuarioId}
            onChange={(e) => setUsuarioId(e.target.value)}
            placeholder="Elige el guardia"
            options={(opciones.data?.guardias ?? []).map((g) => ({ value: String(g.id), label: g.nombre }))}
          />
        </FormField>
      )}
      <FormField label="Tipo de ausencia" required error={errores.tipo}>
        <Select
          value={tipo}
          onChange={(e) => setTipo(e.target.value as TipoAusencia | '')}
          placeholder="Elige el tipo"
          options={TIPOS_AUSENCIA.map((t) => ({ value: t, label: TIPO_AUSENCIA_LABEL[t] }))}
        />
      </FormField>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <FormField label="Desde" required error={errores.desde}>
          <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
        </FormField>
        <FormField label="Hasta" required error={errores.hasta} hint={`Máximo ${DIAS_MAX_AUSENCIA} días.`}>
          <Input type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} />
        </FormField>
      </div>
      <FormField
        label={tipo === 'permiso' || tipo === 'otro' ? 'Motivo' : 'Motivo (opcional)'}
        required={tipo === 'permiso' || tipo === 'otro'}
        error={errores.motivo}
      >
        <Textarea rows={2} maxLength={255} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </FormField>
      {regla !== 'no' && (
        <FormField
          label={regla === 'obligatorio' ? 'Foto del comprobante' : 'Foto del comprobante (opcional)'}
          required={regla === 'obligatorio'}
          error={errores.foto}
          hint={regla === 'obligatorio' ? 'Es obligatoria en ausencias médicas.' : 'Si tienes uno, adjúntalo.'}
        >
          <PhotoUploader value={fotos} onChange={setFotos} max={1} error={errores.foto} />
        </FormField>
      )}
      {puedeResolver && previa.data && previa.data.faltas > 0 && (
        <p className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200 ring-inset">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            En esas fechas ya hay <strong>{previa.data.faltas}</strong>{' '}
            {previa.data.faltas === 1 ? 'falta marcada' : 'faltas marcadas'}: al registrar la ausencia se justifican
            solas.
          </span>
        </p>
      )}
    </FormModal>
  );
}
