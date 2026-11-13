import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { Informe, InformeDia, InformeGuardia, InformeResumen } from '@platinum/shared';
import { MARCA, OFICINAS, altoEncabezado } from '../src/core';
import { generarHorarioPdf } from '../src/modules/horarios/horarios.pdf';
import { generarPdf } from '../src/modules/informes/pdf';

const URL_VERIFICAR = 'https://platinum.example/verificar?folio=ASIS-2026-000001&c=ABCD';
const paginas = (pdf: Buffer) => (pdf.toString('latin1').match(/\/Type \/Page\b(?!s)/g) ?? []).length;

const dias = (n: number): InformeDia[] =>
  Array.from({ length: n }, (_, k) => ({
    fecha: `2026-11-${String(k + 1).padStart(2, '0')}`,
    sitio: 'Poetas 7',
    horario: '08:00 – 20:00',
    entrada: `2026-11-${String(k + 1).padStart(2, '0')}T14:00:00.000Z`,
    retardoMin: null,
    salidaAnticipadaMin: null,
    comidas: [],
    salida: `2026-11-${String(k + 2).padStart(2, '0')}T02:00:00.000Z`,
    minutos: 720,
    esperadosMin: 720,
    estado: 'completa',
    cobertura: false,
    notas: [],
  }));
const resumen = (n: number): InformeResumen => ({
  programados: n, trabajados: n, faltas: 0, justificadas: 0, retardos: 0, retardoMin: 0, salidasAntes: 0, comidas: 0,
  minutosTrabajados: n * 720, minutosEsperados: n * 720,
});
const guardia = (id: number, nombre: string, n: number): InformeGuardia => ({
  id, nombre, email: 'g@x.mx', sitios: ['Poetas 7'], supervisores: [], turnos: ['Todos los días · 08:00 – 20:00'], dias: dias(n), resumen: resumen(n),
});
const informe = (tipo: 'personal' | 'general', guardias: InformeGuardia[], extra: Partial<Informe> = {}): Informe =>
  ({
    id: 1, folio: 'ASIS-2026-000001', tipo, alcance: 'Todos los sitios', guardia: null, desde: '2026-11-01', hasta: '2026-11-30',
    incluirDetalle: true, incluirFirmas: true, generadoPor: 'Alexis', createdAt: '2026-11-15T16:00:00.000Z', codigo: 'ABCD',
    reemplaza: null, reemplazadoPor: null, resumen: resumen(30),
    datos: {
      tipo, desde: '2026-11-01', hasta: '2026-11-30', alcance: 'Todos los sitios', guardias,
      porSitio: [{ sitio: 'Poetas 7', guardias: guardias.length, resumen: resumen(30) }], resumen: resumen(30), hechos: [],
      criterios: ['Las horas las registra el servidor.'],
    },
    ...extra,
  }) as Informe;

describe('marca en los PDF (A-90)', () => {
  it('las piezas de marca existen y dicen lo correcto', () => {
    for (const f of ['membrete-encabezado.png', 'membrete-icono.png', 'membrete-curva.png', 'marca-de-agua.png', 'escudo.png']) {
      expect(existsSync(fileURLToPath(new URL(`../assets/marca/${f}`, import.meta.url)))).toBe(true);
    }
    expect(MARCA.nombre).toBe('GRUPO Platinum');
    expect(MARCA.lema).toBe('SEGURIDAD PRIVADA');
    expect(OFICINAS.map((o) => o.lugar)).toEqual(['Naucalpan', 'Tlalnepantla']);
    // El encabezado oficial a ancho Carta (612 pt) mide lo que su imagen: 2305 x 495.
    expect(altoEncabezado(612)).toBeCloseTo((612 * 495) / 2305, 5);
  });

  it('el informe personal (vertical) sale con membrete y varias hojas sin romperse', async () => {
    const pdf = await generarPdf(informe('personal', [guardia(4, 'Alberto', 30)], { alcance: 'Guardia: Alberto' }), URL_VERIFICAR);
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(paginas(pdf)).toBeGreaterThanOrEqual(2);
    // Cada imagen se guarda una sola vez aunque haya varias hojas (la marca de agua no infla el archivo).
    expect(pdf.length).toBeLessThan(900_000);
  });

  it('el informe general (horizontal) con anexos y reemplazo sale completo', async () => {
    const guardias = [guardia(4, 'Alberto', 30), guardia(5, 'María', 30), guardia(6, 'Pedro', 30)];
    const pdf = await generarPdf(informe('general', guardias, { reemplaza: { id: 9, folio: 'ASIS-2026-000009' } }), URL_VERIFICAR);
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(paginas(pdf)).toBeGreaterThanOrEqual(4);
    expect(pdf.length).toBeLessThan(900_000);
  });

  it('el horario sale con membrete, varias hojas y sin pasarse de tamaño', async () => {
    const pdf = await generarHorarioPdf({
      desde: '2026-11-16', hasta: '2026-11-30', alcance: 'Todos los guardias', generadoPor: 'Alexis', generadoEn: new Date('2026-11-15T16:00:00Z'),
      guardias: Array.from({ length: 7 }, (_, g) => ({
        nombre: `Guardia ${g + 1}`,
        dias: Array.from({ length: 15 }, (_, k) => ({
          fecha: `2026-11-${String(16 + k).padStart(2, '0')}`,
          turnos: k % 4 === 3 ? [] : [{ sitio: 'Poetas 7', horario: '08:00 – 20:00', cobertura: false }],
        })),
      })),
    });
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(paginas(pdf)).toBeGreaterThanOrEqual(3);
    expect(pdf.length).toBeLessThan(900_000);
  });

  it('un informe corto no se dispara en hojas: el membrete de la primera hoja deja las secciones finales para la segunda', async () => {
    const pdf = await generarPdf(informe('personal', [guardia(4, 'Alberto', 2)]), URL_VERIFICAR);
    expect(paginas(pdf)).toBeLessThanOrEqual(2);
  });
});
