import { Fragment } from 'react';
import { AVISO_PRIVACIDAD } from '@platinum/shared';

/** Texto con **negritas** sencillas (las que trae el aviso). */
function Texto({ children }: { children: string }) {
  return (
    <>
      {children.split(/(\*\*[^*]+\*\*)/g).map((trozo, i) =>
        trozo.startsWith('**') ? (
          <strong key={i} className="font-semibold text-slate-900">
            {trozo.slice(2, -2)}
          </strong>
        ) : (
          <Fragment key={i}>{trozo}</Fragment>
        ),
      )}
    </>
  );
}

/** El aviso de privacidad completo, tal como está en `@platinum/shared`. */
export function AvisoPrivacidadTexto() {
  const a = AVISO_PRIVACIDAD;
  return (
    <div className="space-y-4 text-sm leading-relaxed text-slate-700">
      <h3 className="text-base font-semibold text-slate-900">{a.titulo}</h3>
      {a.introduccion.map((p) => (
        <p key={p}>
          <Texto>{p}</Texto>
        </p>
      ))}
      {a.secciones.map((s) => (
        <section key={s.titulo} className="space-y-2">
          <h4 className="font-semibold text-slate-900">{s.titulo}</h4>
          {s.parrafos?.map((p) => (
            <p key={p}>
              <Texto>{p}</Texto>
            </p>
          ))}
          {s.puntos && (
            <ul className="list-disc space-y-1.5 pl-5">
              {s.puntos.map((p) => (
                <li key={p}>
                  <Texto>{p}</Texto>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <p className="text-xs text-slate-500">Última actualización: {a.actualizado}</p>
    </div>
  );
}
