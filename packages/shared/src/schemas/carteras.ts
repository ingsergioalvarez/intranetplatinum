import { z } from 'zod';

/**
 * Carteras de los admin (A-65). Cada admin tiene la suya: lo que creó (usuarios, clientes con sus sitios y grupos).
 * El super admin la pasa de un admin a otro, completa o por elementos, y lo que no reparte queda "sin asignar".
 */
export interface PersonaCartera {
  id: number;
  nombre: string;
  rol: string;
  activo: boolean;
}

export interface CarteraArbol {
  /** null = lo que no tiene dueño (sin asignar). */
  propietario: { id: number; nombre: string; activo: boolean } | null;
  /** Cada supervisor con lo que "tiene detrás": sus guardias y los clientes (con sus sitios) que supervisa. */
  supervisores: (PersonaCartera & {
    guardias: PersonaCartera[];
    clientes: { id: number; nombre: string }[];
  })[];
  clientes: { id: number; nombre: string; sitios: { id: number; nombre: string }[]; accesos: PersonaCartera[] }[];
  guardias: PersonaCartera[];
  /** Usuarios que no son supervisores ni guardias ni accesos de un cliente de la cartera. */
  otros: PersonaCartera[];
  grupos: { id: number; nombre: string; integrantes: number }[];
  totales: { usuarios: number; clientes: number; sitios: number; grupos: number };
}

export interface ResumenCarteras {
  admins: {
    id: number;
    nombre: string;
    activo: boolean;
    esSuperAdmin: boolean;
    usuarios: number;
    clientes: number;
    grupos: number;
  }[];
  sinAsignar: { usuarios: number; clientes: number; grupos: number };
}

const ids = z.array(z.number().int().positive()).max(5000).default([]);

export const transferirCarteraSchema = z
  .object({
    /** Admin del que salen (null = lo sin asignar). */
    origenId: z.number().int().positive().nullable(),
    /** Admin al que pasan (null = dejarlo sin asignar). */
    destinoId: z.number().int().positive().nullable(),
    /** Toda la cartera de origen. */
    todo: z.boolean().default(false),
    usuarioIds: ids,
    clienteIds: ids,
    grupoIds: ids,
    /** Al mover un supervisor, mover también sus guardias y sus clientes; al mover un cliente, sus accesos. */
    cadena: z.boolean().default(true),
  })
  .refine((v) => v.todo || v.usuarioIds.length + v.clienteIds.length + v.grupoIds.length > 0, {
    path: ['usuarioIds'],
    message: 'Elige qué pasar',
  })
  .refine((v) => v.origenId !== v.destinoId, { path: ['destinoId'], message: 'El destino debe ser otro' });
export type TransferirCarteraInput = z.infer<typeof transferirCarteraSchema>;

export interface ResultadoTransferencia {
  usuarios: number;
  clientes: number;
  grupos: number;
  /** Avisos que seguían sin atender y pasaron al admin nuevo. */
  avisos: number;
}
