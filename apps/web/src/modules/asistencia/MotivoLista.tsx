import { FormField, Select, Textarea } from '../../components/ui';

/**
 * Motivo en dos partes: una lista y, con "otro", un texto obligatorio (si no, opcional). Así el sistema
 * siempre sabe el porqué de una decisión.
 */
export function MotivoLista<T extends string>({
  categorias,
  etiquetas,
  categoria,
  nota,
  onCategoria,
  onNota,
  errores,
  placeholderNota,
}: {
  categorias: readonly T[];
  etiquetas: Record<T, string>;
  categoria: T | '';
  nota: string;
  onCategoria: (v: T | '') => void;
  onNota: (v: string) => void;
  errores: { categoria?: string; nota?: string };
  placeholderNota?: string;
}) {
  return (
    <>
      <FormField label="Motivo" required error={errores.categoria}>
        <Select
          value={categoria}
          onChange={(e) => onCategoria(e.target.value as T | '')}
          placeholder="Elige el motivo"
          options={categorias.map((c) => ({ value: c, label: etiquetas[c] }))}
        />
      </FormField>
      <FormField
        label={categoria === 'otro' ? 'Explica el motivo' : 'Detalle (opcional)'}
        required={categoria === 'otro'}
        error={errores.nota}
      >
        <Textarea
          rows={2}
          maxLength={200}
          value={nota}
          onChange={(e) => onNota(e.target.value)}
          placeholder={placeholderNota}
        />
      </FormField>
    </>
  );
}
