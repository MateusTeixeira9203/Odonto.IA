import { test, expect, baseURL, before, login, inicio, capture } from './support';
test.describe.configure({retries:0,timeout:120000});
test('F01 anônimo é enviado ao login', async ({page}) => {
  await page.goto(baseURL + '/dashboard');
  await expect(page).toHaveURL(/\/login/);
});
for (const [role, name] of [['ANA','Ana'],['CARLOS','Carlos'],['ADMIN','Alice']] as const) {
  test('F02 F05 F07 OD013 dentista/admin ' + role, async ({page},info) => {
    await login(page,role); await inicio(page);
    if (!before) await expect(page.locator('h1').first()).toHaveText(new RegExp('^(Bom dia|Boa tarde|Boa noite), ' + name + '$'));
    await expect(page.getByText('Consultas hoje',{exact:true})).toBeVisible();
    await expect(page.getByText('Agenda da semana',{exact:true})).toBeVisible();
    await expect(page.getByText('Concluídos hoje',{exact:true})).toBeVisible();
    if (!before) {
      await expect(page.getByText('Esta semana',{exact:true})).toBeVisible();
      const numbers = await page.locator('#dex-tour-metrics > div > dd:first-of-type').allTextContents();
      expect(numbers).toHaveLength(3);
      for (const n of numbers) expect(n).toMatch(/^\d{2,}$/);
    }
    await capture(page,info,role.toLowerCase() + (before?'-antes':'-depois'));
  });
}
test('F03 aviso de modo consulta preserva destino', async ({page}) => {
  await login(page); await page.goto(baseURL + '/dashboard?bloqueado=modo-consulta');
  await expect(page.getByText('Período de trial encerrado',{exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Assinar agora',exact:true})).toHaveAttribute('href','/dashboard/configuracoes?aba=plano');
});
test('F06 procedimentos do dia abre, fecha e devolve foco', async ({page},info) => {
  await login(page); await inicio(page);
  const trigger=page.getByRole('button',{name:/Ver procedimentos do dia/});
  test.skip(await trigger.count()===0,'Conta sem agendamentos hoje: F06 não exercitado.');
  await trigger.click();
  if(before) {
    const title=page.getByRole('heading',{name:'Procedimentos de hoje',exact:true});
    await expect(title).toBeVisible();
    await capture(page,info,'procedimentos-antes');
    await title.locator('..').locator('..').getByRole('button').click();
    await expect(title).toBeHidden();
    return;
  }
  const dialog=page.getByRole('dialog',{name:'Procedimentos de hoje'});
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText('Procedimentos baseados nas observações de cada agendamento',{exact:true})).toBeVisible();
  await capture(page,info,'procedimentos' + (before?'-antes':'-depois'));
  await page.keyboard.press('Escape'); await expect(dialog).toBeHidden(); await expect(trigger).toBeFocused();
  await trigger.click(); await expect(dialog).toBeVisible();
  if (!before) await page.getByRole('button',{name:'Fechar procedimentos de hoje',exact:true}).click();
  else await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
});
test('F10 confirmação de realizado pode ser cancelada sem gravar', async ({page}) => {
  await login(page); await inicio(page);
  const trigger=page.getByRole('button',{name:'Já foi atendido',exact:true});
  test.skip(await trigger.count()===0,'Sem próximo atendimento ativo: confirmação não exercitada.');
  await trigger.click();
  await expect(page.getByText('Marcar este atendimento como realizado?',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  await expect(trigger).toBeVisible();
});
test('F13 atenção expande e recolhe sem navegação ou escrita', async ({page}) => {
  await login(page); await inicio(page);
  await expect(page.getByRole('heading',{name:'Atenção hoje'})).toBeVisible();
  const expanders=page.locator('button[aria-expanded][aria-controls]');
  test.skip(await expanders.count()===0,'Sem grupo expansível na conta: expansão não exercitada.');
  const button=expanders.first(); await button.click(); await expect(button).toHaveAttribute('aria-expanded','true');
  await button.click(); await expect(button).toHaveAttribute('aria-expanded','false');
});
test('F15 F16 F19 F22 F24 recepção, saudação e atalhos', async ({page},info) => {
  await login(page,'SECRETARIA'); await inicio(page);
  await expect(page.locator('h1').first()).toHaveText(/^(Bom dia|Boa tarde|Boa noite), Sara!/);
  await expect(page.getByRole('heading',{name:/Agenda de hoje/i})).toBeVisible();
  for(const label of ['Consultas hoje','Confirmadas','Aguardando']) await expect(page.getByText(label,{exact:true}).first()).toBeVisible();
  for(const [label,href] of [['Novo agendamento','/dashboard/agendamentos'],['Novo paciente','/dashboard/pacientes/novo'],['Lançar pagamento','/dashboard/financeiro'],['Pacientes','/dashboard/pacientes']]) {
    const link=page.getByRole('link',{name:new RegExp(label,'i')}).filter({hasText:new RegExp(label,'i')});
    await expect(link.first()).toHaveAttribute('href',href);
  }
  if(!before) await expect(page.getByText('Sistema Online',{exact:true})).toHaveCount(0);
  await capture(page,info,'recepcao' + (before?'-antes':'-depois'));
});
test('F19 F23 filtros da recepção e toggle em Dentistas hoje', async ({page}) => {
  test.skip(before,'Seletores semânticos do novo layout; comparação antes no teste visual.');
  await login(page,'SECRETARIA'); await inicio(page);
  const agenda=page.getByRole('region',{name:'Agenda de hoje',exact:true});
  const filters=page.locator('[aria-label="Filtrar agenda por dentista"]');
  await expect(filters).toBeVisible();
  const all=filters.getByRole('button',{name:'Todos',exact:true});
  await expect(all).toHaveAttribute('aria-pressed','true');
  const doctor=filters.getByRole('button').nth(1); await doctor.click(); await expect(doctor).toHaveAttribute('aria-pressed','true');
  const chosen=await doctor.innerText();
  const sidebar=page.getByRole('region',{name:'Dentistas hoje',exact:true});
  const side=sidebar.getByRole('button').filter({hasText:chosen}).first();
  await expect(side).toHaveAttribute('aria-pressed','true');
  await side.click(); await expect(all).toHaveAttribute('aria-pressed','true');
  await expect(agenda.getByRole('link',{name:'Ver agenda completa'})).toHaveAttribute('href','/dashboard/agendamentos');
});
test('F21 assinatura abre e cancela sem confirmar', async ({page}) => {
  await login(page,'SECRETARIA'); await inicio(page);
  const sign=page.getByRole('button',{name:'Assinar',exact:true});
  test.skip(await sign.count()===0,'Sem agendamento elegível: abertura de assinatura não exercitada.');
  await sign.first().click();
  const dialog=page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
  await expect(dialog).toBeHidden();
});
