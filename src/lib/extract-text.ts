// Parsers de texto embutido em documento — extraído de `api/processar-documento`
// (Job A Fatia B, §6) pra ser reusado por `api/extrair-texto` sem duplicar lógica.
// Refactor extrativo (invariante #11): `processar-documento` se comporta idêntico.

export async function extractTextFromFile(buffer: ArrayBuffer, ext: string): Promise<string> {
  if (ext === 'docx' || ext === 'doc') {
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ buffer: Buffer.from(buffer) });
    return result.value;
  }
  if (ext === 'pdf') {
    const pdfParse = (await import('pdf-parse')).default;
    const result = await pdfParse(Buffer.from(buffer));
    return result.text;
  }
  if (ext === 'txt') {
    return new TextDecoder('utf-8').decode(buffer);
  }
  if (ext === 'pptx') {
    const officeParser = (await import('officeparser')).default;
    const resultado = await officeParser.parseOffice(Buffer.from(buffer), {
      outputErrorToConsole: true,
      newlineDelimiter: '\n',
      ignoreNotes: false,
    });
    return String(resultado);
  }
  return '';
}
