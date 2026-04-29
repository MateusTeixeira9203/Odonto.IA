'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText,
  Filter,
  Calendar,
  Search,
  Loader2,
  Upload,
  Plus,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { GaleriaImagens } from '@/components/fichas/galeria-imagens';

interface Document {
  id: string;
  name: string;
  tipo: string;
  category: 'Radiografias' | 'Fotografias' | 'Documentos' | 'Outros';
  date: string;
  source: string;
  url: string;
}

const CATEGORIES = ['Radiografias', 'Fotografias', 'Documentos', 'Outros'] as const;

const ALLOWED_MIME: Record<string, boolean> = {
  'image/jpeg': true,
  'image/png': true,
  'image/webp': true,
  'image/gif': true,
  'image/bmp': true,
  'application/pdf': true,
  'application/msword': true,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true,
  'application/vnd.ms-excel': true,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': true,
  'application/vnd.ms-powerpoint': true,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': true,
};

const MAX_UPLOAD_SIZE = 20 * 1024 * 1024; // 20 MB

function inferMimeFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    bmp: 'image/bmp',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xls: 'application/vnd.ms-excel',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ppt: 'application/vnd.ms-powerpoint',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  };
  return map[ext] ?? 'application/octet-stream';
}

const getCategoryFromFile = (file: File): Document['category'] => {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(ext)) return 'Fotografias';
  if (['pdf', 'docx', 'doc', 'pptx', 'ppt', 'xls', 'xlsx'].includes(ext)) return 'Documentos';
  return 'Outros';
};

interface DocumentosTabProps {
  patientId: string;
  clinicaId: string;
}

export function DocumentosTab({ patientId, clinicaId }: DocumentosTabProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ current: number; total: number } | null>(null);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [modoSelecao, setModoSelecao] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (value: string): void => {
    setSearchTerm(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  };

  const fetchDocuments = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('paciente_documentos')
        .select('*')
        .eq('paciente_id', patientId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedDocs = (data ?? []).map((doc: Record<string, unknown>) => {
        const nome = doc.nome as string;
        return {
          id: doc.id as string,
          name: nome,
          tipo: inferMimeFromName(nome),
          category: doc.categoria as Document['category'],
          date: new Date(doc.created_at as string).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }),
          source: (doc.origem as string | undefined) ?? 'Upload Direto',
          url: doc.url as string,
        };
      });

      setDocuments(formattedDocs);
    } catch (error) {
      console.error('Erro ao buscar documentos:', error);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    if (patientId) {
      void fetchDocuments();
    }
  }, [patientId, fetchDocuments]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = '';

    const invalidos = files.filter(f => !ALLOWED_MIME[f.type]);
    const grandes = files.filter(f => f.size > MAX_UPLOAD_SIZE);

    if (invalidos.length > 0) {
      alert(`Tipo não permitido: ${invalidos.map(f => f.name).join(', ')}\nUse imagens, PDF, DOC, DOCX, XLS, XLSX, PPT ou PPTX.`);
      return;
    }
    if (grandes.length > 0) {
      alert(`Arquivos muito grandes (máx 20 MB): ${grandes.map(f => f.name).join(', ')}`);
      return;
    }

    setIsUploading(true);
    setUploadProgress({ current: 0, total: files.length });

    const supabase = createClient();
    const novos: Document[] = [];
    const erros: string[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress({ current: i + 1, total: files.length });

      try {
        const storagePath = `${clinicaId}/${patientId}/docs/${Date.now()}_${file.name}`;

        const { error: storageErr } = await supabase.storage
          .from('fichas')
          .upload(storagePath, file, { upsert: false });
        if (storageErr) throw storageErr;

        const { data: urlData } = supabase.storage.from('fichas').getPublicUrl(storagePath);

        const { data: docData, error: dbErr } = await supabase
          .from('paciente_documentos')
          .insert({
            paciente_id: patientId,
            clinica_id: clinicaId,
            nome: file.name,
            url: urlData.publicUrl,
            categoria: getCategoryFromFile(file),
          })
          .select('id, created_at')
          .single();
        if (dbErr) throw dbErr;

        const row = docData as Record<string, unknown>;
        novos.push({
          id: row.id as string,
          name: file.name,
          tipo: file.type || inferMimeFromName(file.name),
          category: getCategoryFromFile(file),
          date: new Date(row.created_at as string).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          }),
          source: 'Upload Direto',
          url: urlData.publicUrl,
        });
      } catch (err) {
        console.error(`Erro no upload de ${file.name}:`, err);
        erros.push(file.name);
      }
    }

    if (novos.length > 0) {
      setDocuments(prev => [...novos.reverse(), ...prev]);
    }
    if (erros.length > 0) {
      alert(`Erro ao enviar: ${erros.join(', ')}`);
    }

    setIsUploading(false);
    setUploadProgress(null);
  };

  const handleDeleteDoc = async (docId: string, e: React.MouseEvent): Promise<void> => {
    e.stopPropagation();
    const doc = documents.find(d => d.id === docId);
    if (!doc || !window.confirm(`Excluir "${doc.name}"?`)) return;

    try {
      const supabase = createClient();
      const storagePath = doc.url.split('/storage/v1/object/public/fichas/')[1];

      await Promise.all([
        supabase.from('paciente_documentos').delete().eq('id', docId),
        storagePath
          ? supabase.storage.from('fichas').remove([storagePath])
          : Promise.resolve(),
      ]);

      setDocuments(prev => prev.filter(d => d.id !== docId));
      setSelecionados(prev => prev.filter(id => id !== docId));
    } catch (error) {
      console.error('Erro ao excluir documento:', error);
      alert('Erro ao excluir documento. Tente novamente.');
    }
  };

  const filteredDocs = documents.filter(doc => {
    if (filterMonth && !doc.date.includes(filterMonth)) return false;
    if (filterYear && !doc.date.includes(filterYear)) return false;
    if (debouncedSearch && !doc.name.toLowerCase().includes(debouncedSearch.toLowerCase())) return false;
    return true;
  });

  const years = Array.from(new Set(documents.map(d => d.date.split(' ')[2]))).sort().reverse();
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  return (
    <div className="space-y-8">
      {/* Input oculto para upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
        multiple
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Filtros e ações */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface p-4 rounded-2xl border border-border shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-text-secondary" />
            <span className="text-sm font-semibold text-text-primary">Filtrar por:</span>
          </div>

          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="bg-surface-alt border border-border rounded-lg px-3 py-1.5 text-xs font-bold text-text-primary outline-none focus:border-teal transition-colors"
          >
            <option value="">Todos os Meses</option>
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="bg-surface-alt border border-border rounded-lg px-3 py-1.5 text-xs font-bold text-text-primary outline-none focus:border-teal transition-colors"
          >
            <option value="">Todos os Anos</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          {(filterMonth || filterYear) && (
            <button
              onClick={() => { setFilterMonth(''); setFilterYear(''); }}
              className="text-xs font-bold text-red-500 hover:text-red-600 transition-colors"
            >
              Limpar Filtros
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Botão de modo seleção */}
          <button
            onClick={() => { setModoSelecao(!modoSelecao); if (modoSelecao) setSelecionados([]); }}
            className={`text-xs px-3 py-1.5 rounded-lg font-bold transition-colors ${
              modoSelecao
                ? 'bg-teal text-white'
                : 'bg-surface-alt text-text-secondary hover:bg-border'
            }`}
          >
            {modoSelecao ? `${selecionados.length} selecionado(s)` : 'Selecionar'}
          </button>

          <div className="relative">
            <Search className="w-4 h-4 text-text-secondary absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Buscar arquivo..."
              className="bg-surface-alt border border-border rounded-lg pl-9 pr-4 py-1.5 text-xs font-medium text-text-primary outline-none focus:border-teal transition-colors w-64"
            />
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-teal text-white rounded-lg text-xs font-bold hover:bg-teal-lt transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading && uploadProgress ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> {uploadProgress.current}/{uploadProgress.total}</>
            ) : isUploading ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando...</>
            ) : (
              <><Plus className="w-3.5 h-3.5" /> Adicionar</>
            )}
          </button>
        </div>
      </div>

      {/* Categorias com galeria */}
      {loading ? (
        <div className="flex items-center justify-center p-20">
          <Loader2 className="w-8 h-8 animate-spin text-teal" />
        </div>
      ) : (
        CATEGORIES.map(category => {
          const docsInCategory = filteredDocs.filter(d => d.category === category);
          if (docsInCategory.length === 0) return null;

          return (
            <div key={category} className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <h3 className="font-heading text-lg text-text-primary px-2">{category}</h3>
                <div className="h-px flex-1 bg-border" />
              </div>

              <GaleriaImagens
                documentos={docsInCategory.map(d => ({
                  id: d.id,
                  nome: d.name,
                  url: d.url,
                  tipo: d.tipo,
                  date: d.date,
                }))}
                selecionados={selecionados}
                onSelecionar={setSelecionados}
                modoSelecao={modoSelecao}
                onDelete={handleDeleteDoc}
              />
            </div>
          );
        })
      )}

      {!loading && filteredDocs.length === 0 && (
        <div className="bg-surface rounded-2xl border border-border p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-surface-alt flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-text-secondary" />
          </div>
          <h3 className="font-heading text-xl text-text-primary mb-2">Nenhum documento encontrado</h3>
          <p className="text-text-secondary text-sm max-w-xs">
            Não existem arquivos nesta categoria ou para o período selecionado.
          </p>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="mt-6 flex items-center gap-2 px-5 py-2.5 bg-teal text-white rounded-xl text-sm font-bold hover:bg-teal-lt transition-colors disabled:opacity-50"
          >
            <Upload className="w-4 h-4" /> Adicionar Primeiro Documento
          </button>
        </div>
      )}
    </div>
  );
}
