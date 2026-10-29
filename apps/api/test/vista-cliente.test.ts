import { describe, expect, it } from 'vitest';
import type { AsistenciaGuardia, Jornada, Marcacion, MiSitio } from '@platinum/shared';
import {
  fichaParaCliente,
  filaParaCliente,
  jornadaParaCliente,
} from '../src/modules/asistencia/vista-cliente';

const marca = (id: number, tipo: Marcacion['tipo']): Marcacion => ({
  id,
  tipo,
  registradaEn: '2026-10-20T14:00:00.000Z',
  sitio: { id: 1, nombre: 'POETAS' },
  lat: 0,
  lng: 0,
  precisionM: 10,
  distanciaM: 20,
  alertas: ['retardo', 'rostro_no_coincide', 'sin_lentes_declarado', 'fuera_de_rango'],
  foto: 'https://x/foto.jpg',
  rostro: { distancia: 0.31, intentos: 2 },
  rostroAprobadoEn: '2026-10-20T15:00:00.000Z',
});

const jornada = (sitioId: number): Jornada => ({
  entrada: marca(1, 'entrada'),
  inicioComida: null,
  finComida: null,
  comidas: [{ inicio: marca(2, 'inicio_comida'), fin: marca(3, 'fin_comida') }],
  comidasPermitidas: 1,
  salida: marca(4, 'salida'),
  sitio: { id: sitioId, nombre: `Sitio ${sitioId}` },
  alertas: ['retardo', 'rostro_pendiente', 'rostro_rechazado', 'gps_impreciso'],
  justificadas: [],
  programada: null,
  retardoMin: 12,
  salidaAnticipadaMin: null,
});

describe('asistencia para el cliente (DA-48): sin biometría ni datos de otros clientes', () => {
  it('quita las alertas y el resultado del reconocimiento facial, pero deja lo operativo', () => {
    const j = jornadaParaCliente(jornada(1));
    expect(j.alertas).toEqual(['retardo', 'gps_impreciso']);
    for (const m of [j.entrada, j.comidas[0].inicio, j.comidas[0].fin!, j.salida!]) {
      expect(m.alertas).toEqual(['retardo', 'fuera_de_rango']);
      expect(m.rostro).toBeNull();
      expect(m.rostroAprobadoEn).toBeNull();
    }
    // La foto de la checada (avatar) y los horarios no se tocan.
    expect(j.entrada.foto).toBe('https://x/foto.jpg');
    expect(j.retardoMin).toBe(12);
  });

  it('la fila del día pasa por el mismo filtro', () => {
    const f = filaParaCliente({
      guardia: { id: 4, nombre: 'Juan', email: 'j@x.mx' },
      sitio: { id: 1, nombre: 'POETAS' },
      jornada: jornada(1),
    });
    expect(f.jornada!.entrada.alertas).not.toContain('rostro_no_coincide');
    expect(filaParaCliente({ guardia: f.guardia, sitio: null, jornada: null }).jornada).toBeNull();
  });

  it('la ficha no trae el rostro registrado ni jornadas ni sitios de otros clientes', () => {
    const asignacion = (id: number) =>
      ({ asignacionId: id, sitio: { id, nombre: `Sitio ${id}` } }) as MiSitio;
    const ficha: AsistenciaGuardia = {
      guardia: { id: 4, nombre: 'Juan', email: 'j@x.mx' },
      rostro: { id: 1, fotoUrl: 'https://x/ref.jpg', fotos: ['a', 'b'] } as AsistenciaGuardia['rostro'],
      jornadas: [jornada(1), jornada(2)],
      asignaciones: [asignacion(1), asignacion(2)],
    };
    const r = fichaParaCliente(ficha, { sitioIds: new Set([1]), guardiaIds: new Set([4]) });
    expect(r.rostro).toBeNull();
    expect(r.jornadas.map((j) => j.sitio!.id)).toEqual([1]);
    expect(r.asignaciones.map((a) => a.sitio.id)).toEqual([1]);
  });
});
