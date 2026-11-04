import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { generarPaleta, type ContextoEmpresa, type ModuloOpcionalClave } from '@platinum/shared';
import { api } from '../api';
import { useAuthStore } from '../auth/authStore';
import { useEmpresaStore } from './empresaStore';

const claveContexto = (empresaElegidaId: number | null) => ['mi-empresa', empresaElegidaId] as const;

/** Empresa en la que trabaja la sesión: su marca y sus módulos (C-09). `undefined` mientras carga. */
export function useContextoEmpresa() {
  const hayUsuario = useAuthStore((s) => !!s.user && !s.user.debeCambiarPassword);
  const elegida = useEmpresaStore((s) => s.empresaElegidaId);
  return useQuery({
    queryKey: claveContexto(elegida),
    queryFn: () => api.get<ContextoEmpresa>('/mi-empresa'),
    enabled: hayUsuario,
    staleTime: 60_000,
  });
}

/**
 * ¿Tiene la empresa encendido este módulo? Los siempre incluidos no llegan aquí. Mientras carga el contexto responde
 * `false`, así un módulo apagado nunca parpadea en el menú.
 */
export function useModulo(clave: ModuloOpcionalClave | undefined): boolean {
  const { data } = useContextoEmpresa();
  if (!clave) return true;
  return data?.modulos[clave] === true;
}

/** Función para decidir sobre varios módulos a la vez (menús y listas). */
export function useModulos(): (clave: ModuloOpcionalClave | undefined) => boolean {
  const { data } = useContextoEmpresa();
  return (clave) => !clave || data?.modulos[clave] === true;
}

const ESCALA = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'] as const;

/**
 * Aplica los colores de la empresa a toda la app (variables `--color-brand-*` y de acento). Con la marca por defecto
 * no pinta nada: se queda la paleta de Gestión Comunicalo.
 */
export function useMarcaEmpresa() {
  const { data } = useContextoEmpresa();
  const e = data?.empresa;
  useEffect(() => {
    const raiz = document.documentElement.style;
    const quitar = () => {
      for (const t of ESCALA) raiz.removeProperty(`--color-brand-${t}`);
      raiz.removeProperty('--color-acento-300');
      raiz.removeProperty('--color-acento-400');
    };
    if (!e || e.colorModo === 'defecto' || !e.colorPrincipal) {
      quitar();
      return;
    }
    const { brand, acento } = generarPaleta(e.colorPrincipal, e.colorAcento);
    for (const t of ESCALA) raiz.setProperty(`--color-brand-${t}`, brand[t]);
    raiz.setProperty('--color-acento-300', acento['300']);
    raiz.setProperty('--color-acento-400', acento['400']);
    return quitar;
  }, [e?.colorModo, e?.colorPrincipal, e?.colorAcento]); // eslint-disable-line react-hooks/exhaustive-deps
}
