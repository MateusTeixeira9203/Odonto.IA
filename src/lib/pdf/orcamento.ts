import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Font,
  renderToBuffer,
} from "@react-pdf/renderer";
import { createElement } from "react";

// Tipos
interface Procedimento {
  id: string;
  nome: string;
  dente?: string;
  valor: number;
  quantidade: number;
}

interface OrcamentoData {
  id: string;
  numero: number;
  data: string;
  validade: string;
  status: string;
  paciente: {
    nome: string;
    cpf?: string;
    telefone?: string;
  };
  clinica: {
    nome: string;
    endereco?: string;
    telefone?: string;
    cnpj?: string;
    logo_url?: string;
  };
  dentista: {
    nome: string;
    cro: string;
  };
  procedimentos: Procedimento[];
  subtotal: number;
  desconto: number;
  total: number;
  forma_pagamento?: string;
  observacoes?: string;
}

// Estilos
const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    backgroundColor: "#ffffff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: "#2f9c85",
  },
  clinicaInfo: {
    flex: 1,
  },
  clinicaNome: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#2f9c85",
    marginBottom: 4,
  },
  clinicaDetalhe: {
    fontSize: 9,
    color: "#666666",
    marginBottom: 2,
  },
  orcamentoInfo: {
    alignItems: "flex-end",
  },
  orcamentoNumero: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#333333",
  },
  orcamentoData: {
    fontSize: 9,
    color: "#666666",
    marginTop: 4,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    color: "#2f9c85",
    marginBottom: 10,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  row: {
    flexDirection: "row",
    marginBottom: 4,
  },
  label: {
    width: 100,
    fontSize: 9,
    color: "#666666",
  },
  value: {
    flex: 1,
    fontSize: 10,
    color: "#333333",
  },
  table: {
    marginTop: 10,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f5f5f5",
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e0e0e0",
  },
  tableHeaderText: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#333333",
  },
  tableRow: {
    flexDirection: "row",
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  tableCell: {
    fontSize: 9,
    color: "#333333",
  },
  colProcedimento: { flex: 3 },
  colDente: { width: 50, textAlign: "center" },
  colQtd: { width: 40, textAlign: "center" },
  colValor: { width: 80, textAlign: "right" },
  colTotal: { width: 80, textAlign: "right" },
  totais: {
    marginTop: 20,
    alignItems: "flex-end",
  },
  totalRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  totalLabel: {
    width: 120,
    fontSize: 10,
    color: "#666666",
    textAlign: "right",
    marginRight: 10,
  },
  totalValue: {
    width: 100,
    fontSize: 10,
    color: "#333333",
    textAlign: "right",
  },
  totalFinal: {
    flexDirection: "row",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 2,
    borderTopColor: "#2f9c85",
  },
  totalFinalLabel: {
    width: 120,
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#2f9c85",
    textAlign: "right",
    marginRight: 10,
  },
  totalFinalValue: {
    width: 100,
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#2f9c85",
    textAlign: "right",
  },
  footer: {
    position: "absolute",
    bottom: 40,
    left: 40,
    right: 40,
    textAlign: "center",
    fontSize: 8,
    color: "#999999",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#e0e0e0",
  },
  observacoes: {
    marginTop: 20,
    padding: 12,
    backgroundColor: "#f9f9f9",
    borderRadius: 4,
  },
  observacoesText: {
    fontSize: 9,
    color: "#666666",
    lineHeight: 1.4,
  },
  assinatura: {
    marginTop: 40,
    alignItems: "center",
  },
  assinaturaLinha: {
    width: 200,
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
    marginBottom: 4,
  },
  assinaturaTexto: {
    fontSize: 9,
    color: "#666666",
  },
});

// Formatar moeda
function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

// Formatar data
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("pt-BR");
}

// Componente do documento
function OrcamentoPDF({ data }: { data: OrcamentoData }) {
  return createElement(
    Document,
    null,
    createElement(
      Page,
      { size: "A4", style: styles.page },
      // Header
      createElement(
        View,
        { style: styles.header },
        createElement(
          View,
          { style: styles.clinicaInfo },
          createElement(Text, { style: styles.clinicaNome }, data.clinica.nome),
          data.clinica.endereco &&
            createElement(Text, { style: styles.clinicaDetalhe }, data.clinica.endereco),
          data.clinica.telefone &&
            createElement(Text, { style: styles.clinicaDetalhe }, `Tel: ${data.clinica.telefone}`),
          data.clinica.cnpj &&
            createElement(Text, { style: styles.clinicaDetalhe }, `CNPJ: ${data.clinica.cnpj}`)
        ),
        createElement(
          View,
          { style: styles.orcamentoInfo },
          createElement(Text, { style: styles.orcamentoNumero }, `Orçamento #${data.numero}`),
          createElement(Text, { style: styles.orcamentoData }, `Emissão: ${formatDate(data.data)}`),
          createElement(Text, { style: styles.orcamentoData }, `Validade: ${formatDate(data.validade)}`)
        )
      ),
      // Dados do Paciente
      createElement(
        View,
        { style: styles.section },
        createElement(Text, { style: styles.sectionTitle }, "Paciente"),
        createElement(
          View,
          { style: styles.row },
          createElement(Text, { style: styles.label }, "Nome:"),
          createElement(Text, { style: styles.value }, data.paciente.nome)
        ),
        data.paciente.cpf &&
          createElement(
            View,
            { style: styles.row },
            createElement(Text, { style: styles.label }, "CPF:"),
            createElement(Text, { style: styles.value }, data.paciente.cpf)
          ),
        data.paciente.telefone &&
          createElement(
            View,
            { style: styles.row },
            createElement(Text, { style: styles.label }, "Telefone:"),
            createElement(Text, { style: styles.value }, data.paciente.telefone)
          )
      ),
      // Tabela de Procedimentos
      createElement(
        View,
        { style: styles.section },
        createElement(Text, { style: styles.sectionTitle }, "Procedimentos"),
        createElement(
          View,
          { style: styles.table },
          // Header da tabela
          createElement(
            View,
            { style: styles.tableHeader },
            createElement(Text, { style: [styles.tableHeaderText, styles.colProcedimento] }, "Procedimento"),
            createElement(Text, { style: [styles.tableHeaderText, styles.colDente] }, "Dente"),
            createElement(Text, { style: [styles.tableHeaderText, styles.colQtd] }, "Qtd"),
            createElement(Text, { style: [styles.tableHeaderText, styles.colValor] }, "Valor Unit."),
            createElement(Text, { style: [styles.tableHeaderText, styles.colTotal] }, "Total")
          ),
          // Linhas
          ...data.procedimentos.map((proc, idx) =>
            createElement(
              View,
              { style: styles.tableRow, key: idx },
              createElement(Text, { style: [styles.tableCell, styles.colProcedimento] }, proc.nome),
              createElement(Text, { style: [styles.tableCell, styles.colDente] }, proc.dente || "-"),
              createElement(Text, { style: [styles.tableCell, styles.colQtd] }, String(proc.quantidade)),
              createElement(Text, { style: [styles.tableCell, styles.colValor] }, formatCurrency(proc.valor)),
              createElement(Text, { style: [styles.tableCell, styles.colTotal] }, formatCurrency(proc.valor * proc.quantidade))
            )
          )
        )
      ),
      // Totais
      createElement(
        View,
        { style: styles.totais },
        createElement(
          View,
          { style: styles.totalRow },
          createElement(Text, { style: styles.totalLabel }, "Subtotal:"),
          createElement(Text, { style: styles.totalValue }, formatCurrency(data.subtotal))
        ),
        data.desconto > 0 &&
          createElement(
            View,
            { style: styles.totalRow },
            createElement(Text, { style: styles.totalLabel }, "Desconto:"),
            createElement(Text, { style: styles.totalValue }, `- ${formatCurrency(data.desconto)}`)
          ),
        createElement(
          View,
          { style: styles.totalFinal },
          createElement(Text, { style: styles.totalFinalLabel }, "Total:"),
          createElement(Text, { style: styles.totalFinalValue }, formatCurrency(data.total))
        )
      ),
      // Forma de pagamento
      data.forma_pagamento &&
        createElement(
          View,
          { style: styles.section },
          createElement(Text, { style: styles.sectionTitle }, "Forma de Pagamento"),
          createElement(Text, { style: styles.value }, data.forma_pagamento)
        ),
      // Observações
      data.observacoes &&
        createElement(
          View,
          { style: styles.observacoes },
          createElement(Text, { style: styles.sectionTitle }, "Observações"),
          createElement(Text, { style: styles.observacoesText }, data.observacoes)
        ),
      // Assinatura
      createElement(
        View,
        { style: styles.assinatura },
        createElement(View, { style: styles.assinaturaLinha }),
        createElement(Text, { style: styles.assinaturaTexto }, `${data.dentista.nome} - CRO: ${data.dentista.cro}`)
      ),
      // Footer
      createElement(
        Text,
        { style: styles.footer },
        `Documento gerado em ${new Date().toLocaleDateString("pt-BR")} às ${new Date().toLocaleTimeString("pt-BR")} • Odonto.IA`
      )
    )
  );
}

// Função principal para gerar PDF
export async function gerarPDFOrcamento(data: OrcamentoData): Promise<Buffer> {
  const doc = OrcamentoPDF({ data });
  const buffer = await renderToBuffer(doc);
  return buffer;
}

export type { OrcamentoData, Procedimento };
