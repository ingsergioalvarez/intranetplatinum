import { MEDIDA_LABEL, OPCIONES_MEDIDA, type OpcionMedida } from '@platinum/shared';
import { FormField, Select } from '../../components/ui';

/**
 * Medida disciplinaria opcional (A-48, A-49): ninguna, llamada de atención verbal o amonestación por
 * escrito. Si se elige una, queda en el historial formal del guardia y en su bitácora.
 */
export function MedidaCampo({
  value,
  onChange,
}: {
  value: OpcionMedida;
  onChange: (v: OpcionMedida) => void;
}) {
  return (
    <FormField
      label="Medida disciplinaria (opcional)"
      hint="Si aplicas una, queda en el historial del guardia y en su bitácora, y se le avisa."
    >
      <Select
        value={value}
        onChange={(e) => onChange(e.target.value as OpcionMedida)}
        options={OPCIONES_MEDIDA.map((m) => ({ value: m, label: MEDIDA_LABEL[m] }))}
      />
    </FormField>
  );
}
