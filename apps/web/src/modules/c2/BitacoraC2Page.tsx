import { PageHeader } from '../../components/layout/AppShell';
import { BitacoraC2 } from './BitacoraC2';

/** Bitácora del C2 para el supervisor (A-82): lo que pasó con sus sitios y lo que hizo el C2. Solo lectura. */
export function BitacoraC2Page() {
  return (
    <>
      <PageHeader title="Bitácora del C2" subtitle="Lo que pasó con tus sitios y lo que hizo el C2" />
      <BitacoraC2 />
    </>
  );
}
