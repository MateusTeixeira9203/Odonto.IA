import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import { createElement } from "react";

export interface DocumentoPDFData {
  titulo: string;
  corpo: string;
  duasVias: boolean;
  paciente: { nome: string; cpf?: string };
  clinica: { nome: string; endereco?: string; telefone?: string; cnpj?: string };
  dentista: { nome: string; cro: string };
  data: string; // ISO
}

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 11, fontFamily: "Helvetica", backgroundColor: "#ffffff", color: "#222222" },
  via: { flexGrow: 1 },
  viaLabel: { fontSize: 8, color: "#999999", marginBottom: 8, textAlign: "right" },
  divider: { borderTopWidth: 1, borderTopColor: "#cccccc", borderStyle: "dashed", marginVertical: 18 },
  header: { flexDirection: "row", justifyContent: "space-between", marginBottom: 18, paddingBottom: 12, borderBottomWidth: 2, borderBottomColor: "#2f9c85" },
  clinicaNome: { fontSize: 15, fontFamily: "Helvetica-Bold", color: "#2f9c85" },
  clinicaDetalhe: { fontSize: 8, color: "#666666", marginTop: 2 },
  titulo: { fontSize: 13, fontFamily: "Helvetica-Bold", textAlign: "center", marginVertical: 14, textTransform: "uppercase", letterSpacing: 1 },
  pacienteLinha: { fontSize: 10, marginBottom: 12 },
  corpo: { fontSize: 11, lineHeight: 1.6, marginBottom: 24 },
  dataLinha: { fontSize: 10, marginTop: 8, marginBottom: 36 },
  assinatura: { alignItems: "center", marginTop: 10 },
  assinaturaLinha: { width: 230, borderBottomWidth: 1, borderBottomColor: "#333333", marginBottom: 4 },
  assinaturaTexto: { fontSize: 9, color: "#444444" },
});

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR");
}

function Via({ data, label }: { data: DocumentoPDFData; label?: string }) {
  return createElement(
    View, { style: styles.via },
    label ? createElement(Text, { style: styles.viaLabel }, label) : null,
    createElement(
      View, { style: styles.header },
      createElement(
        View, null,
        createElement(Text, { style: styles.clinicaNome }, data.clinica.nome),
        data.clinica.endereco ? createElement(Text, { style: styles.clinicaDetalhe }, data.clinica.endereco) : null,
        data.clinica.telefone ? createElement(Text, { style: styles.clinicaDetalhe }, `Tel: ${data.clinica.telefone}`) : null,
        data.clinica.cnpj ? createElement(Text, { style: styles.clinicaDetalhe }, `CNPJ: ${data.clinica.cnpj}`) : null,
      ),
    ),
    createElement(Text, { style: styles.titulo }, data.titulo),
    createElement(Text, { style: styles.pacienteLinha },
      `Paciente: ${data.paciente.nome}${data.paciente.cpf ? `  •  CPF: ${data.paciente.cpf}` : ""}`),
    createElement(Text, { style: styles.corpo }, data.corpo),
    createElement(Text, { style: styles.dataLinha }, `Data: ${formatDate(data.data)}`),
    createElement(
      View, { style: styles.assinatura },
      createElement(View, { style: styles.assinaturaLinha }),
      createElement(Text, { style: styles.assinaturaTexto },
        `${data.dentista.nome} — CRO: ${data.dentista.cro || "—"}`),
    ),
  );
}

function DocumentoPDF({ data }: { data: DocumentoPDFData }) {
  return createElement(
    Document, null,
    createElement(
      Page, { size: "A4", style: styles.page },
      data.duasVias
        ? createElement(
            View, { style: { flexDirection: "column", flexGrow: 1 } },
            createElement(Via, { data, label: "1ª via — Farmácia" }),
            createElement(View, { style: styles.divider }),
            createElement(Via, { data, label: "2ª via — Paciente" }),
          )
        : createElement(Via, { data }),
    ),
  );
}

export async function gerarPDFDocumento(data: DocumentoPDFData): Promise<Buffer> {
  return renderToBuffer(DocumentoPDF({ data }));
}
