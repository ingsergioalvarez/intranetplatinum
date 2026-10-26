import type { ReactNode } from 'react';
import { cn } from './cn';
import { EmptyState } from './EmptyState';
import { Spinner } from './Spinner';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  /** En celular: 'title' encabeza la tarjeta, 'subtitle' va debajo, 'hidden' no se muestra. */
  mobile?: 'title' | 'subtitle' | 'field' | 'hidden';
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
  /** Acciones por fila (botones), visibles en tabla y tarjeta. */
  actions?: (row: T) => ReactNode;
  /** Título visible de la columna de acciones (por omisión va vacía, solo con aria-label). */
  actionsHeader?: string;
}

/** Tabla en escritorio y lista de tarjetas en celular, con la misma definición de columnas. */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  loading,
  emptyTitle = 'Sin registros',
  emptyDescription,
  onRowClick,
  actions,
  actionsHeader,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className="flex justify-center py-12 text-brand-600">
        <Spinner className="size-7" />
      </div>
    );
  }

  if (rows.length === 0) return <EmptyState title={emptyTitle} description={emptyDescription} />;

  const title = columns.find((c) => c.mobile === 'title') ?? columns[0];
  const subtitle = columns.find((c) => c.mobile === 'subtitle');
  const fields = columns.filter((c) => c !== title && c !== subtitle && c.mobile !== 'hidden');

  return (
    <>
      {/* Celular: tarjetas */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn('px-4 py-3', onRowClick && 'cursor-pointer active:bg-slate-50')}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate font-medium text-slate-900">{title.render(row)}</div>
                {subtitle && <div className="truncate text-sm text-slate-500">{subtitle.render(row)}</div>}
              </div>
              {actions && (
                <div className="flex shrink-0 gap-1" onClick={(e) => e.stopPropagation()}>
                  {actions(row)}
                </div>
              )}
            </div>
            {fields.length > 0 && (
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {fields.map((c) => (
                  <div key={c.key} className="min-w-0">
                    <dt className="text-xs text-slate-500">{c.header}</dt>
                    <dd className="truncate text-slate-800">{c.render(row)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </li>
        ))}
      </ul>

      {/* Escritorio: tabla */}
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn('px-4 py-3 text-left font-semibold text-slate-600', c.className)}
                >
                  {c.header}
                </th>
              ))}
              {actions && (
                <th
                  scope="col"
                  className={cn('px-4 py-3', actionsHeader && 'text-right font-semibold text-slate-600')}
                  aria-label={actionsHeader ? undefined : 'Acciones'}
                >
                  {actionsHeader}
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(onRowClick && 'cursor-pointer hover:bg-slate-50')}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-4 py-3 text-slate-800', c.className)}>
                    {c.render(row)}
                  </td>
                ))}
                {actions && (
                  <td className="px-4 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex gap-1">{actions(row)}</div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
