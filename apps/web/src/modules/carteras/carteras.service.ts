import type {
  CarteraArbol,
  ResultadoTransferencia,
  ResumenCarteras,
  TransferirCarteraInput,
} from '@platinum/shared';
import { api } from '../../core/api';

/** Carteras de los admin (A-65): solo el super admin. */
export const carterasService = {
  keys: {
    all: ['carteras'] as const,
    resumen: ['carteras', 'resumen'] as const,
    arbol: (propietario: number | null) => ['carteras', 'arbol', propietario ?? 'sin-asignar'] as const,
  },
  resumen: () => api.get<ResumenCarteras>('/carteras'),
  arbol: (propietario: number | null) => api.get<CarteraArbol>(`/carteras/${propietario ?? 'sin-asignar'}`),
  transferir: (input: TransferirCarteraInput) => api.post<ResultadoTransferencia>('/carteras/transferir', input),
};
