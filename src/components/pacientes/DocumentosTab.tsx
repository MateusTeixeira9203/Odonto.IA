'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileText,
  Eye,
  Filter,
  X,
  Calendar,
  Search,
  Loader2,
  Download,
  Upload,
  Plus,
  Trash2,
} from 'lucide-react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';

interface Document {
  id: string;
  name: string;
  category: 'Radiografias' | 'Fotografias' | 'Documentos' | 'Outros';
  date: string;
  source: string;
  url: string;
  thumbnail: string;
}

const CATEGORIES = ['Radiografias', 'Fotografias', 'Documentos', 'Outros'] as const;

const ALLOWED_MIME: Record<string, boolean> = {
  'image/jpeg': true,
  'image/png': true,
  'image/webp': true,
  'application/pdf': true,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true,
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': true,
};
const MAX_UPLOAD_SIZE = 20 * 1024 * 1024; // 20 MB

const getCategoryFromFile = (file: File): Document['category'] => {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return 'Fotografias';
  if (['pdf', 'docx', 'pptx'].includes(ext)) return 'Documentos';
  return 'Outros';
};

interface DocumentosTabProps {
  patientId: string;
  clinicaId: string;
}

export function DocumentosTab({ patientId, clinicaId }: DocumentosTabProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [filterMonth, setFilterMonth] = useState('');
  const [filterYear, setFilterYear] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => setDebouncedSearch(value), 300);
  };

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('paciente_documentos')
        .select('*')
        .eq('paciente_id', patientId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedDocs = (data ?? []).map((doc: Record<string, unknown>) => ({
        id: doc.id as string,
        name: doc.nome as string,
        category: doc.categoria as Document['category'],
        date: new Date(doc.created_at as string).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        source: (doc.origem as string | undefined) ?? 'Upload Direto',
        url: doc.url as string,
        thumbnail: (doc.thumbnail as string | undefined) ?? (doc.url as string),
      }));

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
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!ALLOWED_MIME[file.type]) {
      alert('Tipo não permitido. Use JPG, PNG, WEBP, PDF, DOCX ou PPTX.');
      return;
    }
    if (file.size > MAX_UPLOAD_SIZE) {
      alert('Arquivo muito grande. Máximo 20 MB.');
      return;
    }

    setIsUploading(true);
    try {
      const supabase = createClient();
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
      const newDoc: Document = {
        id: row.id as string,
        name: file.name,
        category: getCategoryFromFile(file),
        date: new Date(row.created_at as string).toLocaleDateString('pt-BR', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        source: 'Upload Direto',
        url: urlData.publicUrl,
        thumbnail: urlData.publicUrl,
      };

      setDocuments(prev => [newDoc, ...prev]);
    } catch (err) {
      console.error('Erro no upload:', err);
      alert('Erro ao fazer upload. Tente novamente.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDoc = async (doc: Document, e: React.MouseEvent): Promise<void> => {
    e.stopPropagation();
    if (!window.confirm(`Excluir "${doc.name}"?`)) return;

    try {
      const supabase = createClient();
      // Extrai o caminho no bucket a partir da URL pública
      const storagePath = doc.url.split('/storage/v1/object/public/fichas/')[1];

      await Promise.all([
        supabase.from('paciente_documentos').delete().eq('id', doc.id),
        storagePath
          ? supabase.storage.from('fichas').remove([storagePath])
          : Promise.resolve(),
      ]);

      setDocuments(prev => prev.filter(d => d.id !== doc.id));
      if (selectedDoc?.id === doc.id) setSelectedDoc(null);
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
        accept=".jpg,.jpeg,.png,.webp,.pdf,.docx,.pptx"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-surface p-4 rounded-2xl border border-border shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-md" />
            <span className="text-sm font-semibold text-black">Filtrar por:</span>
          </div>

          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="bg-surface-alt border border-border rounded-lg px-3 py-1.5 text-xs font-bold text-black outline-none focus:border-teal transition-colors"
          >
            <option value="">Todos os Meses</option>
            {months.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="bg-surface-alt border border-border rounded-lg px-3 py-1.5 text-xs font-bold text-black outline-none focus:border-teal transition-colors"
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
          <div className="relative">
            <Search className="w-4 h-4 text-gray-md absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Buscar arquivo..."
              className="bg-surface-alt border border-border rounded-lg pl-9 pr-4 py-1.5 text-xs font-medium text-black outline-none focus:border-teal transition-colors w-64"
            />
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-teal text-white rounded-lg text-xs font-bold hover:bg-teal-lt transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enviando...</>
            ) : (
              <><Plus className="w-3.5 h-3.5" /> Adicionar</>
            )}
          </button>
        </div>
      </div>

      {/* Categorias */}
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
                <h3 className="font-heading text-lg text-black px-2">{category}</h3>
                <div className="h-px flex-1 bg-border" />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {docsInCategory.map(doc => (
                  <motion.div
                    key={doc.id}
                    whileHover={{ y: -4 }}
                    className="group bg-surface rounded-xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer"
                    onClick={() => setSelectedDoc(doc)}
                  >
                    <div className="aspect-square relative bg-surface-alt overflow-hidden">
                      <Image
                        src={doc.thumbnail}
                        alt={doc.name}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-500"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
                          <Eye className="w-4 h-4" />
                        </div>
                        <button
                          onClick={(e) => void handleDeleteDoc(doc, e)}
                          className="w-8 h-8 rounded-full bg-red-500/80 backdrop-blur-md flex items-center justify-center text-white hover:bg-red-600 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="p-3">
                      <div className="text-[10px] font-bold text-teal uppercase tracking-wider mb-1 truncate">
                        {doc.name}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-[9px] font-medium text-gray-md flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {doc.date}
                        </div>
                      </div>
                      <div className="mt-2 pt-2 border-t border-border text-[8px] font-bold text-gray-md uppercase truncate">
                        {doc.source}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          );
        })
      )}

      {!loading && filteredDocs.length === 0 && (
        <div className="bg-surface rounded-2xl border border-border p-12 flex flex-col items-center justify-center text-center">
          <div className="w-16 h-16 rounded-full bg-surface-alt flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-gray-md" />
          </div>
          <h3 className="font-heading text-xl text-black mb-2">Nenhum documento encontrado</h3>
          <p className="text-gray-md text-sm max-w-xs">
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

      {/* Modal Visualizador */}
      <AnimatePresence>
        {selectedDoc && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDoc(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-sm"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-5xl bg-surface rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-full"
            >
              {/* Cabeçalho do Modal */}
              <div className="p-4 sm:p-6 border-b border-border flex items-center justify-between bg-surface">
                <div>
                  <h3 className="font-heading text-xl text-black">{selectedDoc.name}</h3>
                  <div className="flex items-center gap-3 mt-1">
                    <span className="text-xs font-bold text-teal uppercase tracking-wider">{selectedDoc.category}</span>
                    <span className="text-xs font-medium text-gray-md">• {selectedDoc.date}</span>
                    <span className="text-xs font-medium text-gray-md">• {selectedDoc.source}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button className="p-2 rounded-xl bg-surface-alt hover:bg-border transition-colors text-black">
                    <Download className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setSelectedDoc(null)}
                    className="p-2 rounded-xl bg-black text-white hover:bg-zinc-800 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Conteúdo do Modal */}
              <div className="flex-1 overflow-auto p-4 sm:p-8 bg-surface-alt/30 flex items-center justify-center min-h-[300px]">
                <div className="relative w-full h-full min-h-[400px]">
                  <Image
                    src={selectedDoc.url}
                    alt={selectedDoc.name}
                    fill
                    className="object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>

              {/* Rodapé do Modal */}
              <div className="p-4 border-t border-border bg-surface flex justify-end">
                <button
                  onClick={() => setSelectedDoc(null)}
                  className="px-6 py-2.5 rounded-xl bg-black text-white font-bold text-sm hover:bg-zinc-800 transition-colors"
                >
                  Fechar Visualização
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
