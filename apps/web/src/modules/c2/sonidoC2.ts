import { useEffect, useRef, useState } from 'react';
import { detenerSirena, iniciarSirena, probarSirena } from '../emergencias/sirena';

/**
 * Sonido del C2 (A-61): suena mientras haya algo sin atender (un sitio solo o un SOS) y se puede silenciar. Silenciar
 * apaga lo que hay ahora; si después aparece algo nuevo, vuelve a sonar. Los navegadores no dejan sonar hasta que la
 * persona toca algo, por eso hay que activarlo con el botón al entrar.
 */
export function useSonidoC2(alertas: string[]) {
  const [activo, setActivo] = useState(false);
  const [bloqueado, setBloqueado] = useState(false);
  const [silenciadas, setSilenciadas] = useState<Set<string>>(new Set());
  const anteriores = useRef<string[]>([]);

  // Lo silenciado que ya se resolvió se olvida: si vuelve a pasar, tiene que sonar otra vez.
  useEffect(() => {
    setSilenciadas((prev) => {
      const vigentes = new Set([...prev].filter((k) => alertas.includes(k)));
      return vigentes.size === prev.size ? prev : vigentes;
    });
    anteriores.current = alertas;
  }, [alertas]);

  const sinAtender = alertas.filter((k) => !silenciadas.has(k));
  const debeSonar = activo && sinAtender.length > 0;

  useEffect(() => {
    if (!debeSonar) {
      detenerSirena();
      setBloqueado(false);
      return;
    }
    setBloqueado(!iniciarSirena());
    return () => detenerSirena();
  }, [debeSonar]);

  return {
    activo,
    /** Hay algo sin atender y el navegador no deja sonar: hay que tocar la pantalla. */
    bloqueado,
    sonando: debeSonar && !bloqueado,
    /** Enciende o apaga el sonido; al encender suena 2 s para comprobar el volumen. */
    alternar() {
      if (activo) {
        setActivo(false);
        return;
      }
      setActivo(true);
      // Con algo pendiente suena ya (y sigue); sin nada, 2 s para comprobar el volumen.
      setBloqueado(!(alertas.length > 0 ? iniciarSirena() : probarSirena()));
    },
    silenciar() {
      setSilenciadas(new Set(alertas));
    },
    haySilenciadas: alertas.length > 0 && sinAtender.length === 0,
  };
}
