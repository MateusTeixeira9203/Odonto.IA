'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, MicOff, Upload, Save, Loader2, FileText, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

const TEETH_UPPER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const TEETH_LOWER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

// Tooth-type width: molars wider, incisors narrower
const TOOTH_WIDTH: Record<number, string> = {
  1: 'w-7', 2: 'w-7', // central/lateral incisors
  3: 'w-7',            // canine
  4: 'w-8', 5: 'w-8', // premolars
  6: 'w-9', 7: 'w-9', 8: 'w-9', // molars
};
const toothWidth = (t: number) => TOOTH_WIDTH[t % 10] ?? 'w-8';

const ALLOWED_MIME: Record<string, boolean> = {
  'image/jpeg': true,
  'image/png': true,
  'image/webp': true,
  'application/pdf': true,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': true,
};
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024; // 10 MB
const getCategoria = (mime: string) => (mime.startsWith('image/') ? 'Fotografias' : 'Documentos');

interface NovaEvolucaoPanelProps {
  onCancel: () => void;
  onSave: () => void;
  clinicaId: string;
  patientId: string;
}

export function NovaEvolucaoPanel({ onCancel, onSave, clinicaId, patientId }: NovaEvolucaoPanelProps) {
  const [type, setType] = useState('Evolução');
  const [generalObs, setGeneralObs] = useState('');
  const [selectedTeeth, setSelectedTeeth] = useState<number[]>([]);
  const [toothObs, setToothObs] = useState<Record<number, string>>({});
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<
    Array<{ name: string; url: string; docId: string; storagePath: string }>
  >([]);
  const [isUploading, setIsUploading] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const toggleTooth = (tooth: number) => {
    setSelectedTeeth(prev =>
      prev.includes(tooth) ? prev.filter(t => t !== tooth) : [...prev, tooth]
    );
  };

  const handleToothObsChange = (tooth: number, value: string) => {
    setToothObs(prev => ({ ...prev, [tooth]: value }));
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Erro ao acessar microfone:', err);
      toast.error('Não foi possível acessar o microfone.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (blob: Blob): Promise<void> => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('audio', blob, 'gravacao.webm');

      const response = await fetch('/api/transcrever', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Falha na transcrição');

      const data = await response.json() as { texto?: string };
      if (data.texto) {
        setGeneralObs(prev => prev ? `${prev}\n${data.texto}` : data.texto!);
      }
    } catch (error) {
      console.error('Erro na transcrição:', error);
      toast.error('Erro ao transcrever áudio.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    if (!ALLOWED_MIME[file.type]) {
      toast.error('Tipo não permitido. Use JPG, PNG, WEBP, PDF ou DOCX.');
      return;
    }
    if (file.size > MAX_UPLOAD_SIZE) {
      toast.error('Arquivo muito grande. Máximo 10 MB.');
      return;
    }

    setIsUploading(true);
    try {
      const supabase = createClient();
      const storagePath = `${clinicaId}/${patientId}/${Date.now()}_${file.name}`;

      const { error: storageErr } = await supabase.storage
        .from('fichas')
        .upload(storagePath, file, { upsert: false });
      if (storageErr) throw storageErr;

      const { data: signedData } = await supabase.storage
        .from('fichas')
        .createSignedUrl(storagePath, 3600);
      const displayUrl = signedData?.signedUrl ?? '';

      const { data: doc, error: dbErr } = await supabase
        .from('paciente_documentos')
        .insert({
          paciente_id: patientId,
          clinica_id: clinicaId,
          nome: file.name,
          url: storagePath,
          categoria: getCategoria(file.type),
        })
        .select('id')
        .single();
      if (dbErr) throw dbErr;

      setUploadedFiles((prev) => [
        ...prev,
        { name: file.name, url: displayUrl, docId: doc.id as string, storagePath },
      ]);
    } catch (err) {
      console.error('Erro no upload:', err);
      toast.error('Erro ao fazer upload. Tente novamente.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = async (docId: string, storagePath: string) => {
    try {
      const supabase = createClient();
      await Promise.all([
        supabase.from('paciente_documentos').delete().eq('id', docId),
        supabase.storage.from('fichas').remove([storagePath]),
      ]);
      setUploadedFiles((prev) => prev.filter((f) => f.docId !== docId));
    } catch (err) {
      console.error('Erro ao remover arquivo:', err);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0, marginTop: 0 }}
      animate={{ opacity: 1, height: 'auto', marginTop: 24 }}
      exit={{ opacity: 0, height: 0, marginTop: 0 }}
      className="overflow-hidden"
    >
      <div className="bg-surface-alt/30 border border-border rounded-2xl p-6 flex flex-col lg:flex-row gap-8">

        {/* Coluna Esquerda (60%) */}
        <div className="flex-[3] flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">
                Tipo de Registro
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full bg-surface border border-border rounded-xl px-4 py-2.5 text-sm font-medium text-text-primary outline-none focus:border-teal transition-colors"
              >
                <option value="Avaliação">Avaliação</option>
                <option value="Evolução">Evolução</option>
                <option value="Retorno">Retorno</option>
                <option value="Urgência">Urgência</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">
                Observações Gerais
              </label>
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isTranscribing}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  isRecording
                    ? 'bg-red-100 text-red-600 hover:bg-red-200 animate-pulse'
                    : 'bg-teal-pale text-teal hover:bg-teal/20'
                }`}
              >
                {isTranscribing ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Transcrevendo...</>
                ) : isRecording ? (
                  <><MicOff className="w-3.5 h-3.5" /> Parar Gravação</>
                ) : (
                  <><Mic className="w-3.5 h-3.5" /> Gravar Voz (IA)</>
                )}
              </button>
            </div>
            <textarea
              value={generalObs}
              onChange={(e) => setGeneralObs(e.target.value)}
              placeholder="Descreva os procedimentos realizados, queixas do paciente, etc..."
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm font-medium text-text-primary outline-none focus:border-teal transition-colors min-h-[120px] resize-y"
            />
          </div>

          {/* Campos Dinâmicos por Dente */}
          <AnimatePresence>
            {selectedTeeth.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em]">
                  Observações por Dente
                </label>
                <div className="space-y-3">
                  {selectedTeeth.map(tooth => (
                    <motion.div
                      key={tooth}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      className="flex items-start gap-3"
                    >
                      <div className="w-10 h-10 shrink-0 rounded-lg bg-teal text-white flex items-center justify-center font-mono text-sm font-bold shadow-sm">
                        {tooth}
                      </div>
                      <input
                        type="text"
                        value={toothObs[tooth] ?? ''}
                        onChange={(e) => handleToothObsChange(tooth, e.target.value)}
                        placeholder={`Procedimento no dente ${tooth}...`}
                        className="flex-1 bg-surface border border-border rounded-xl px-4 py-2.5 text-sm font-medium text-text-primary outline-none focus:border-teal transition-colors"
                      />
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div>
            <label className="block text-[10px] font-bold text-text-secondary uppercase tracking-[0.15em] mb-2">
              Anexos
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf,.docx"
              className="hidden"
              onChange={handleFileSelect}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="w-full border-2 border-dashed border-border hover:border-teal bg-surface rounded-xl py-6 flex flex-col items-center justify-center gap-2 text-text-secondary hover:text-teal transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? (
                <><Loader2 className="w-6 h-6 animate-spin" /><span className="text-sm font-medium">Enviando...</span></>
              ) : (
                <><Upload className="w-6 h-6" /><span className="text-sm font-medium">Clique para fazer upload de imagens ou raio-x</span></>
              )}
            </button>
            {uploadedFiles.length > 0 && (
              <ul className="mt-3 space-y-2">
                {uploadedFiles.map((f) => (
                  <li key={f.docId} className="flex items-center gap-2 bg-surface border border-border rounded-lg px-3 py-2">
                    <FileText className="w-4 h-4 text-teal shrink-0" />
                    <span className="flex-1 text-sm font-medium text-text-primary truncate">{f.name}</span>
                    <button
                      onClick={() => handleRemoveFile(f.docId, f.storagePath)}
                      className="text-text-secondary hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              onClick={onCancel}
              className="px-5 py-2.5 rounded-xl font-semibold text-sm text-text-secondary hover:text-text-primary hover:bg-surface transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={onSave}
              className="bg-teal hover:bg-teal-lt text-white px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all shadow-[0_0_15px_rgba(47,156,133,0.3)] hover:shadow-[0_0_20px_rgba(93,190,176,0.5)]"
            >
              <Save className="w-4 h-4" />
              Salvar Evolução
            </button>
          </div>
        </div>

        {/* Coluna Direita (40%) - Odontograma */}
        <div className="flex-[2] bg-surface rounded-xl border border-border p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading text-base text-text-primary">Odontograma</h3>
            <div className="flex items-center gap-2.5 text-[10px] font-bold uppercase tracking-wider text-text-secondary">
              <span className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-sm bg-teal inline-block" /> Selecionado
              </span>
            </div>
          </div>

          {/* Quadrant headers */}
          <div className="flex justify-center mb-1">
            <div className="flex w-full max-w-xs sm:max-w-sm justify-between text-[9px] font-bold uppercase tracking-widest text-text-secondary px-1">
              <span>Dir.</span>
              <span>Esq.</span>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center gap-1">
            {/* Upper teeth */}
            <div className="flex justify-center items-end gap-0.5">
              {TEETH_UPPER.map((tooth, idx) => {
                const isSelected = selectedTeeth.includes(tooth);
                const isCenterLeft = idx === 7; // tooth 11 — right of center
                return (
                  <div key={tooth} className="flex items-end">
                    {isCenterLeft && (
                      <div className="w-px h-8 bg-border mx-1 self-stretch" />
                    )}
                    <button
                      onClick={() => toggleTooth(tooth)}
                      title={`Dente ${tooth}`}
                      className={`${toothWidth(tooth)} h-10 rounded-t-lg rounded-b-[3px] border flex items-center justify-center font-mono text-[10px] font-bold transition-all hover:scale-105 active:scale-95 ${
                        isSelected
                          ? 'bg-teal border-teal text-white -translate-y-1.5 shadow-[0_4px_12px_rgba(47,156,133,0.4)]'
                          : 'bg-surface-alt border-border text-text-secondary hover:border-teal/60 hover:text-teal hover:bg-teal/5'
                      }`}
                    >
                      {tooth}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Arch separator */}
            <div className="flex justify-center">
              <div className="w-full max-w-xs sm:max-w-sm h-px bg-border my-1" />
            </div>

            {/* Lower teeth */}
            <div className="flex justify-center items-start gap-0.5">
              {TEETH_LOWER.map((tooth, idx) => {
                const isSelected = selectedTeeth.includes(tooth);
                const isCenterLeft = idx === 7; // tooth 41 — right of center
                return (
                  <div key={tooth} className="flex items-start">
                    {isCenterLeft && (
                      <div className="w-px h-8 bg-border mx-1 self-stretch" />
                    )}
                    <button
                      onClick={() => toggleTooth(tooth)}
                      title={`Dente ${tooth}`}
                      className={`${toothWidth(tooth)} h-10 rounded-b-lg rounded-t-[3px] border flex items-center justify-center font-mono text-[10px] font-bold transition-all hover:scale-105 active:scale-95 ${
                        isSelected
                          ? 'bg-teal border-teal text-white translate-y-1.5 shadow-[0_-4px_12px_rgba(47,156,133,0.4)]'
                          : 'bg-surface-alt border-border text-text-secondary hover:border-teal/60 hover:text-teal hover:bg-teal/5'
                      }`}
                    >
                      {tooth}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom quadrant labels */}
          <div className="flex justify-center mt-1 mb-3">
            <div className="flex w-full max-w-xs sm:max-w-sm justify-between text-[9px] font-bold uppercase tracking-widest text-text-secondary px-1">
              <span>Dir.</span>
              <span>Esq.</span>
            </div>
          </div>

          {selectedTeeth.length > 0 ? (
            <p className="text-center text-xs text-teal font-semibold">
              {selectedTeeth.length} dente{selectedTeeth.length !== 1 ? 's' : ''} selecionado{selectedTeeth.length !== 1 ? 's' : ''}
            </p>
          ) : (
            <p className="text-center text-[11px] text-text-secondary">
              Clique nos dentes para adicionar observações.
            </p>
          )}
        </div>

      </div>
    </motion.div>
  );
}
