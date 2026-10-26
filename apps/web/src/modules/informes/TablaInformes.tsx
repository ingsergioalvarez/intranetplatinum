import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Eye, FileSpreadsheet, FileText, Search } from 'lucide-react';
import { TIPOS_INFORME, TIPO_INFORME_LABEL, type InformeResumenFila, type TipoInforme } from '@platinum/shared';
import { Badge, Button, DataTable, Input, Pagination, Select, toast, type Column } from '../../components/ui';
import { mensajeDeError } from '../../core/api';
import { formatFechaHora } from '../../core/format/fechas';
import { useDebounced } from '../../core/hooks/useDebounced';
import { periodoTexto } from './formato';
import { informesService, type FormatoInforme } from './informes.service';

const LIMIT = 15;

/** Folio con su estado: un reporte reemplazado se ve tachado y dice cuál lo sustituyó. */
export function FolioInforme({ i }: { i: InformeResumenFila }) {
  return (
    <span className="block">
      <span className={`font-mono text-xs font-semibold ${i.reemplazadoPor ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
        {i.folio}
      </span>
      {i.reemplazadoPor && (
        <span className="block text-xs text-amber-700">Reemplazado por {i.reemplazadoPor.folio}</span>
      )}
      {i.reemplaza && !i.reemplazadoPor && (
        <span className="block text-xs text-slate-500">Reemplaza a {i.reemplaza.folio}</span>
      )}
    </span>
  );
}

/**
 * Reportes emitidos (DA-52): tabla de solo lectura. Cada fila se puede ver en pantalla (tal como
 * se emitió) o descargar en PDF oficial / Excel de trabajo; nunca se edita ni se borra.
 */
export function TablaInformes({ guardiaId, filtros = true }: { guardiaId?: number; filtros?: boolean }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [tipo, setTipo] = useState<TipoInforme | ''>('');
  const [mes, setMes] = useState('');
  const [page, setPage] = useState(1);
  const [bajando, setBajando] = useState<string | null>(null);
  const busqueda = useDebounced(q.trim());

  const params = { q: busqueda || undefined, tipo: tipo || undefined, mes: mes || undefined, guardiaId, page, limit: LIMIT };
  const lista = useQuery({
    queryKey: informesService.keys.list(params),
    queryFn: () => informesService.list(params),
    placeholderData: keepPreviousData,
  });

  const descargar = async (i: InformeResumenFila, formato: FormatoInforme) => {
    setBajando(`${i.id}-${formato}`);
    try {
      await informesService.descargar(i, formato);
    } catch (e) {
      toast.error(mensajeDeError(e));
    } finally {
      setBajando(null);
    }
  };

  const columns: Column<InformeResumenFila>[] = [
    { key: 'folio', header: 'Folio', mobile: 'title', className: 'whitespace-nowrap', render: (i) => <FolioInforme i={i} /> },
    {
      key: 'tipo',
      header: 'Tipo',
      mobile: 'hidden',
      render: (i) => <Badge tone={i.tipo === 'personal' ? 'brand' : 'info'}>{TIPO_INFORME_LABEL[i.tipo]}</Badge>,
    },
    {
      key: 'alcance',
      header: 'Guardia / Alcance',
      mobile: 'subtitle',
      className: 'whitespace-nowrap',
      render: (i) => <span className="font-medium text-slate-800">{i.guardia?.nombre ?? i.alcance}</span>,
    },
    { key: 'periodo', header: 'Periodo', className: 'whitespace-nowrap', render: periodoTexto },
    { key: 'genero', header: 'Generó', className: 'whitespace-nowrap', render: (i) => <span className="text-slate-700">{i.generadoPor ?? '—'}</span> },
    {
      key: 'fecha',
      header: 'Fecha',
      className: 'whitespace-nowrap',
      render: (i) => <span className="text-slate-600">{formatFechaHora(i.createdAt)}</span>,
    },
  ];

  return (
    <div>
      {filtros && (
        <div className="grid grid-cols-1 gap-2 border-b border-slate-100 p-3 sm:grid-cols-[minmax(0,1fr)_10rem_11rem]">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-9"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              placeholder="Buscar por folio, guardia o sitio"
              aria-label="Buscar reportes"
            />
          </div>
          <Select
            aria-label="Tipo de reporte"
            value={tipo}
            onChange={(e) => {
              setTipo(e.target.value as TipoInforme | '');
              setPage(1);
            }}
            placeholder="Todos los tipos"
            options={TIPOS_INFORME.map((t) => ({ value: t, label: TIPO_INFORME_LABEL[t] }))}
          />
          <Input
            type="month"
            aria-label="Periodo (mes)"
            value={mes}
            onChange={(e) => {
              setMes(e.target.value);
              setPage(1);
            }}
          />
        </div>
      )}
      <DataTable
        columns={columns}
        rows={lista.data?.items ?? []}
        rowKey={(i) => i.id}
        loading={lista.isPending}
        emptyTitle="Aún no hay reportes emitidos"
        emptyDescription="Genera uno con “Nuevo reporte”: se guarda aquí con su folio."
        actionsHeader="Acciones"
        actions={(i) => (
          <>
            <Button
              size="sm"
              variant="secondary"
              icon={<Eye className="size-4" />}
              aria-label={`Ver ${i.folio}`}
              onClick={() => navigate(`/asistencia/reportes/${i.id}`)}
            >
              <span className="hidden sm:inline">Ver</span>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={<FileText className="size-4" />}
              aria-label={`Descargar PDF de ${i.folio}`}
              loading={bajando === `${i.id}-pdf`}
              disabled={!!bajando}
              onClick={() => void descargar(i, 'pdf')}
            >
              <span className="hidden sm:inline">PDF</span>
            </Button>
            <Button
              size="sm"
              variant="secondary"
              icon={<FileSpreadsheet className="size-4" />}
              aria-label={`Descargar Excel de ${i.folio}`}
              loading={bajando === `${i.id}-excel`}
              disabled={!!bajando}
              onClick={() => void descargar(i, 'excel')}
            >
              <span className="hidden sm:inline">Excel</span>
            </Button>
          </>
        )}
      />
      {lista.data && <Pagination page={page} limit={LIMIT} total={lista.data.total} onPageChange={setPage} />}
    </div>
  );
}
