'use client';
import type { ClinicaResult, ResultadosClinica } from '@/server/clinica/contracts';
import { carregarResultadosClinica } from '@/app/clinica/actions';
import { ResultadosClinicaWorkspace } from './resultados-clinica';
export function ResultadosClinicaClient(props: { clinicaId: string; mesInicial: string; initialResult: ClinicaResult<ResultadosClinica> }) { return <ResultadosClinicaWorkspace {...props} load={carregarResultadosClinica} />; }
