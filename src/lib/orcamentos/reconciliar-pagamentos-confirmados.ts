type RegistroComPagamentos<TPagamento> = {
  id: string;
  pagamentos: TPagamento[];
};

export function reconciliarPagamentosConfirmados<
  TPagamento,
  TRegistro extends RegistroComPagamentos<TPagamento>,
>(registros: TRegistro[], registroId: string, pagamentos: TPagamento[] | undefined): {
  confirmado: boolean;
  registros: TRegistro[];
} {
  if (!pagamentos) return { confirmado: false, registros };

  return {
    confirmado: true,
    registros: registros.map((registro) => (
      registro.id === registroId ? { ...registro, pagamentos } : registro
    )),
  };
}
