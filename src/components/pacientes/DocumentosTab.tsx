'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { motion } from 'motion/react';
import { FileText, Image, Scan, Paperclip, FolderOpen, ExternalLink } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { PhotoGallery, type FotoItem } from '@/components/pacientes/PhotoGallery';
import type { FichaArquivo } from '@/types/database';

type TipoArquivo = FichaArquivo['tipo'];

const GRUPOS: {
  tipo: TipoArquivo;
  label: string;
  icon: React.ElementType;
  color: string;
}[] = [
  { tipo: 'radiografia', label: 'Radiografias', icon: Scan, color: 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400' },
  { tipo: 'foto_ficha', label: 'Fotografias', icon: Image, color: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400' },
  { tipo: 'documento', label: 'Documentos', icon: FileText, color: 'bg-teal/10 text-teal' },
];

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const SELECT_CLASS =
  'h-8 rounded-lg border border-border bg-surface px-2.5 font-sans text-xs text-text-secondary focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal/30 transition-colors';

// Extensões aceitas como imagem no bucket fichas
const EXTENSOES_IMAGEM = new Set(['jpg', 'jpeg', 'png', 'webp']);

interface Props {
  patientId: string;
  clinicaId: string;
  arquivos: FichaArquivo[];
}

export function DocumentosTab({ patientId, clinicaId, arquivos }: Props): React.JSX.Element {
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');

  // Estado das fotos do paciente carregadas do Supabase Storage
  const [fotos, setFotos] = useState<FotoItem[]>([]);
  const [carregandoFotos, setCarregandoFotos] = useState(true);

  // Carrega fotos do paciente diretamente do bucket fichas ao montar o componente
  useEffect(() => {
    const supabase = createClient();
    const pasta = `${clinicaId}/${patientId}`;

    supabase.storage
      .from('fichas')
      .list(pasta, { limit: 200, sortBy: { column: 'created_at', order: 'desc' } })
      .then(({ data: files }) => {
        if (!files) { setCarregandoFotos(false); return; }

        // Filtra apenas arquivos de imagem pelo nome
        const fotoItems: FotoItem[] = files
          .filter((f) => {
            const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
            return EXTENSOES_IMAGEM.has(ext);
          })
          .map((f) => {
            const { data: urlData } = supabase.storage
              .from('fichas')
              .getPublicUrl(`${pasta}/${f.name}`);
            return {
              id: f.id ?? f.name,
              url: urlData.publicUrl,
              nome: f.name,
              created_at: f.created_at ?? new Date().toISOString(),
            };
          });

        setFotos(fotoItems);
        setCarregandoFotos(false);
      })
      .catch(() => setCarregandoFotos(false));
  }, [clinicaId, patientId]);

  // Adiciona foto ao estado local sem recarregar a página
  function handleFotoAdded(foto: FotoItem): void {
    setFotos((prev) => [foto, ...prev]);
  }

  // Remove foto do estado local (PhotoGallery já cuida do Storage delete)
  function handleFotoRemoved(id: string): void {
    setFotos((prev) => prev.filter((f) => f.id !== id));
  }

  // Empty state: sem arquivos e sem fotos, e já terminou o carregamento
  if (arquivos.length === 0 && fotos.length === 0 && !carregandoFotos) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-surface rounded-2xl border border-border flex flex-col items-center gap-4 py-14"
      >
        <FolderOpen className="w-10 h-10 text-text-muted" />
        <div className="text-center">
          <p className="font-sans text-sm font-medium text-text-primary">Nenhum arquivo ainda</p>
          <p className="font-sans text-xs text-text-secondary mt-1">
            Anexe radiografias, fotos e documentos diretamente nas fichas clínicas
          </p>
        </div>
        <Link
          href={`/dashboard/fichas/nova?paciente_id=${patientId}`}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium bg-teal/10 text-teal hover:bg-teal/20 transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          Criar ficha para adicionar arquivos
        </Link>
      </motion.div>
    );
  }

  // Anos únicos dos arquivos de ficha E das fotos do paciente, ordem decrescente
  const anosDisponiveis = Array.from(
    new Set([
      ...arquivos.map((a) => new Date(a.created_at).getFullYear()),
      ...fotos.map((f) => new Date(f.created_at).getFullYear()),
    ])
  ).sort((a, b) => b - a);

  // Filtra arquivos de ficha pelo mês/ano selecionado
  const arquivosFiltrados = arquivos.filter((a) => {
    const data = new Date(a.created_at);
    if (filterMonth && data.getMonth() + 1 !== Number(filterMonth)) return false;
    if (filterYear && data.getFullYear() !== Number(filterYear)) return false;
    return true;
  });

  // Filtra fotos do paciente pelo mesmo mês/ano
  const fotosFiltradas = fotos.filter((f) => {
    const data = new Date(f.created_at);
    if (filterMonth && data.getMonth() + 1 !== Number(filterMonth)) return false;
    if (filterYear && data.getFullYear() !== Number(filterYear)) return false;
    return true;
  });

  // Conta arquivos (excluindo foto_ficha que agora vai para a gallery) + fotos
  const totalArquivos = arquivosFiltrados.filter((a) => a.tipo !== 'foto_ficha').length;
  const total = totalArquivos + fotosFiltradas.length;
  const filtroAtivo = filterMonth !== '' || filterYear !== '';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Resumo + filtros */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="font-sans text-sm text-text-secondary">
          {total} arquivo{total !== 1 ? 's' : ''} em {fichasUnicas(arquivosFiltrados)} ficha{fichasUnicas(arquivosFiltrados) !== 1 ? 's' : ''}
          {filtroAtivo && <span className="text-teal"> (filtrado)</span>}
        </p>

        <div className="flex items-center gap-2">
          {/* Filtro por mês */}
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">Todos os meses</option>
            {MESES.map((nome, i) => (
              <option key={i + 1} value={String(i + 1)}>
                {nome}
              </option>
            ))}
          </select>

          {/* Filtro por ano */}
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">Todos os anos</option>
            {anosDisponiveis.map((ano) => (
              <option key={ano} value={String(ano)}>
                {ano}
              </option>
            ))}
          </select>

          {/* Limpar filtros */}
          {filtroAtivo && (
            <button
              onClick={() => { setFilterMonth(''); setFilterYear(''); }}
              className="h-8 px-2.5 rounded-lg font-sans text-xs text-text-secondary hover:text-teal transition-colors"
            >
              Limpar
            </button>
          )}

          <Link
            href={`/dashboard/fichas/nova?paciente_id=${patientId}`}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-teal hover:text-teal-dark transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Adicionar via ficha
          </Link>
        </div>
      </div>

      {/* Grupos por tipo */}
      {GRUPOS.map(({ tipo, label, icon: Icon, color }) => {
        // Fotografias: renderiza o PhotoGallery com fotos do Storage (não a lista estática)
        if (tipo === 'foto_ficha') {
          return (
            <div key={tipo} className="bg-surface rounded-2xl border border-border overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <p className="font-sans text-sm font-semibold text-text-primary">{label}</p>
                <span className="ml-auto font-mono text-xs text-text-secondary">
                  {carregandoFotos ? '…' : fotosFiltradas.length}
                </span>
              </div>
              <div className="p-4">
                <PhotoGallery
                  pacienteId={patientId}
                  clinicaId={clinicaId}
                  fotos={fotosFiltradas}
                  onFotoAdded={handleFotoAdded}
                  onFotoRemoved={handleFotoRemoved}
                />
              </div>
            </div>
          );
        }

        // Radiografias e Documentos: lista estática existente
        const itens = arquivosFiltrados.filter((a) => a.tipo === tipo);
        if (itens.length === 0) return null;

        return (
          <div key={tipo} className="bg-surface rounded-2xl border border-border overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <p className="font-sans text-sm font-semibold text-text-primary">{label}</p>
              <span className="ml-auto font-mono text-xs text-text-secondary">{itens.length}</span>
            </div>
            <div className="divide-y divide-border">
              {itens.map((arquivo) => (
                <div
                  key={arquivo.id}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-surface-alt/60 transition-colors"
                >
                  <Paperclip className="w-3.5 h-3.5 text-text-secondary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-sans text-sm text-text-primary truncate">
                      {arquivo.nome_original}
                    </p>
                    <p className="font-mono text-xs text-text-secondary">
                      {format(new Date(arquivo.created_at), 'dd/MM/yyyy')}
                    </p>
                  </div>
                  {arquivo.storage_url && (
                    <a
                      href={arquivo.storage_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal hover:text-teal-dark transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Empty state quando filtro não retorna resultados */}
      {total === 0 && filtroAtivo && (
        <div className="bg-surface rounded-2xl border border-border flex flex-col items-center gap-3 py-10">
          <p className="font-sans text-sm text-text-secondary">
            Nenhum arquivo encontrado para o período selecionado
          </p>
          <button
            onClick={() => { setFilterMonth(''); setFilterYear(''); }}
            className="font-sans text-xs text-teal hover:underline"
          >
            Limpar filtros
          </button>
        </div>
      )}
    </motion.div>
  );
}

// Conta fichas únicas referenciadas pelos arquivos de ficha
function fichasUnicas(arquivos: FichaArquivo[]): number {
  return new Set(arquivos.map((a) => a.ficha_id)).size;
}
