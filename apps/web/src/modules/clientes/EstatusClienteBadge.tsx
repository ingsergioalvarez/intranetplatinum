import { ESTATUS_CLIENTE_LABEL, type Cliente } from '@platinum/shared';
import { Badge } from '../../components/ui';

/** De baja tiene prioridad sobre el estatus del servicio. */
export function EstatusClienteBadge({ cliente }: { cliente: Pick<Cliente, 'estatus' | 'deletedAt'> }) {
  if (cliente.deletedAt) return <Badge>De baja</Badge>;
  return (
    <Badge tone={cliente.estatus === 'activo' ? 'success' : 'warning'}>
      {ESTATUS_CLIENTE_LABEL[cliente.estatus]}
    </Badge>
  );
}
