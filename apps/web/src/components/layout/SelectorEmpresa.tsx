import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { api, mensajeDeError, queryClient } from '../../core/api';
import { useAuthStore } from '../../core/auth/authStore';
import { useEmpresaStore } from '../../core/empresa/empresaStore';
import { plataformaService } from '../../modules/plataforma/plataforma.service';
import { toast } from '../ui';

/**
 * Selector de empresa del super admin (C-09): elige en cuál trabaja. Cada vez que entra a otra queda en la auditoría.
 * Para cualquier otro usuario no aparece.
 */
export function SelectorEmpresa({ className }: { className?: string }) {
  const esSuper = useAuthStore((s) => !!s.user?.esSuperAdmin);
  const elegida = useEmpresaStore((s) => s.empresaElegidaId);
  const elegir = useEmpresaStore((s) => s.elegir);
  const navigate = useNavigate();
  const empresas = useQuery({
    queryKey: plataformaService.keys.empresas('activas', ''),
    queryFn: () => plataformaService.listar('activas', ''),
    enabled: esSuper,
  });
  if (!esSuper || !empresas.data || empresas.data.length < 2) return null;

  const mia = empresas.data.find((e) => e.esMiEmpresa)?.id ?? null;
  const actual = elegida ?? mia;

  async function cambiar(id: number) {
    if (id === actual) return;
    try {
      if (id !== mia) await api.post(`/plataforma/empresas/${id}/entrar`);
      elegir(id === mia ? null : id);
      // Todo lo que había en memoria era de la otra empresa.
      queryClient.clear();
      navigate('/');
    } catch (e) {
      toast.error(mensajeDeError(e));
    }
  }

  return (
    <label className={className}>
      <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-brand-300">
        <Building2 className="size-3.5" aria-hidden="true" /> Trabajando en
      </span>
      <select
        value={actual ?? ''}
        onChange={(e) => void cambiar(Number(e.target.value))}
        className="h-10 w-full rounded-lg border-0 bg-brand-800 px-3 text-sm text-white ring-1 ring-white/15 focus:ring-2 focus:ring-acento-400"
      >
        {empresas.data.map((e) => (
          <option key={e.id} value={e.id}>
            {e.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}
