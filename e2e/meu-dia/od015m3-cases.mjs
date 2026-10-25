export async function run(stage,h){
 const {assert,expect,e,save,ids,db,rows,hash,login,state,action,capture,check,confirmation,openFicha,openDelete,fillDialog,base}=h;
 const noEffect=c=>assert.deepEqual(c.after,c.before,'Unexpected effect');
 if(stage.startsWith('ui-OD021-')){const {run:runOd021}=await import('./od015m3-od021.mjs');await runOd021(stage,h);return;}
 if(stage==='ui-inspect'||stage==='ui-inspect2'||stage==='ui-resume-proof'){
   const a=await login('ANA');await a.page.goto(base+'/dashboard/pacientes/'+ids.patient);await a.page.getByRole('tab',{name:'Prontuário',exact:true}).click({timeout:20000});
   await a.page.getByRole('button',{name:/^Abrir ficha/}).first().waitFor({timeout:20000});e.patientInitialDom=await a.page.locator('body').innerText();e.cardButtons=await a.page.getByRole('button',{name:/^Abrir ficha/}).allTextContents();await capture(a.page,'00-prontuario-inicial');
   const url='/_next/static/chunks/_app-pages-browser_src_components_pacientes_ProntuarioTab_tsx.js';const asset=await a.page.request.get(base+url);const source=await asset.text();const proof={base,url,http:asset.status(),hasRlsRecovery:source.includes('recuperarConfirmacaoOrcamento'),hasWarning:source.includes('avisoOrcamentoPreservado'),hasCopyPromise:source.includes('cópia protegida'),hash:hash(source)};assert.equal(asset.status(),200);assert(proof.hasRlsRecovery);assert(!proof.hasCopyPromise);e.resumeProof=proof;
   if(stage==='ui-resume-proof')for(const c of e.cases.filter(c=>/^UI (1440|390)/.test(c.label))){c.attemptStatus=c.status;c.status='NAO TESTADO';c.invalidForAcceptance=true;c.reason='Captura do 3000 com texto M3b fora do escopo; histórico preservado, repetição autorizada em 3012 congelado.';}
   save();console.log('PASSOU código autorizado servido em '+base+'; sem texto M3b');
 }
 if(['E2-E9-negativas','E2-E9-parser','E-direct-active'].includes(stage)){
   if(stage==='E-direct-active')for(const old of e.cases.filter(c=>c.failure==='Missing action result')){old.attemptStatus=old.status;old.status='NAO TESTADO';old.harnessNote='Manifest antigo 409... não aparece no chunk atual; falha apply antes da função. Referência ativa 609... conferida no chunk do navegador, sem restart. Hashes iguais; tentativas preservadas.';}
   const a=await login('ANA');await openFicha(a.page,ids.EX2);
   await check('E2 nome errado UI e motivo Outro',async c=>{
     const d=await openDelete(a.page);await d.waitFor();await fillDialog(d,{name:'Nome errado'});c.disabledWrong=await d.getByRole('button',{name:'Apagar ficha',exact:true}).isDisabled();assert(c.disabledWrong);
     await fillDialog(d,{motivo:'outro',detail:'abc'});c.disabledShort=await d.getByRole('button',{name:'Apagar ficha',exact:true}).isDisabled();assert(c.disabledShort);
     await d.getByRole('textbox',{name:'Descreva em poucas palavras, sem dados clínicos',exact:true}).fill('QA detalhe de exclusão');await expect(d.getByRole('button',{name:'Apagar ficha',exact:true})).toBeEnabled();
     await capture(a.page,'E2-nome-motivo');await d.getByRole('button',{name:'Cancelar',exact:true}).click();return {guarded:true};
   },c=>{assert(c.response.guarded);noEffect(c);});
   for(const [label,ficha,confirm,message]of [
     ['E2 nome errado ação',ids.EX2,confirmation({nomePaciente:'Nome errado'}),/nome.*confirm|Digite o nome/i],
     ['motivo inválido ação',ids.EX2,confirmation({motivo:'xyz'}),/motivo válido/],
     ['Outro sem detalhe ação',ids.EX2,confirmation({motivo:'outro'}),/5 e 200/],
     ['E9 sem caixa false',ids.EXO,confirmation(),/Marque a caixa/],
     ['E9 sem caixa null',ids.EXO,confirmation({confirmaOrcamentoAceito:null}),/Marque a caixa/]
   ])await check(label,()=>action('ANA','deletarFicha',[ficha,confirm]),c=>{assert.equal(c.response.result.ok,false);assert.match(c.response.result.error,message);noEffect(c);});
 }
 if(stage==='E3-E7-permissoes'){
   for(const role of ['ANA','CARLOS','SARA','PROTETICO','BRUNO','ADMIN'])await login(role);
   for(const role of ['CARLOS','SARA','PROTETICO','BRUNO','ADMIN']){
     await check('permissão ação '+role+' não apaga EX2 Ana',()=>action(role,'deletarFicha',[ids.EX2,confirmation()]),c=>{assert.equal(c.response.result.ok,false);noEffect(c);});
   }
   for(const [label,ficha,patient,message]of [['E3 assinada',ids.ES,ids.patient,/assinatura|documento clínico/],['retirado',ids.FR,ids.extraPatient,/procedimento retirado/],['encaminhado',ids.FE,ids.extraPatient,/procedimento encaminhado/]]){
     await check(label+' UI recusa clara',async c=>{
       const p=h.sessions.ANA.page;await openFicha(p,ficha,patient);const d=await openDelete(p);await p.getByText(message).last().waitFor({timeout:10000});c.text=await p.locator('body').innerText();c.dialogVisible=await d.isVisible();assert(!c.dialogVisible);await capture(p,label.split(' ')[0]+'-recusa');return {refused:true};
     },c=>{assert(c.response.refused);noEffect(c);});
     await check(label+' ação recusada',()=>action('ANA','deletarFicha',[ficha,confirmation({nomePaciente:patient===ids.patient?'Paciente Exclusao QA':'QA M3 Extras 795872d 20261025',confirmaOrcamentoAceito:true})]),c=>{assert.equal(c.response.result.ok,false);assert.match(c.response.result.error,message);noEffect(c);});
   }
   for(const role of ['CARLOS','SARA','PROTETICO'])await check('UI perfil acesso '+role,async c=>{
     const p=h.sessions[role].page;await p.goto(base+'/dashboard/pacientes/'+ids.patient);await p.waitForTimeout(2000);c.url=p.url();c.text=await p.locator('body').innerText();c.prontuarioTabs=await p.getByRole('tab',{name:'Prontuário',exact:true}).count();
     if(role==='CARLOS'&&c.prontuarioTabs){await p.getByRole('tab',{name:'Prontuário',exact:true}).click();c.ownFichaButtons=await p.getByRole('button',{name:/^Abrir ficha.*OD015M3 EX2/}).count();}
     await capture(p,'perfil-'+role);return {checked:true};
   },c=>{if(role==='SARA'||role==='PROTETICO')assert.equal(c.prontuarioTabs,0);noEffect(c);});
   await check('E6 Carlos Novo atendimento em EX2 alheia sem visita vazia',()=>action('CARLOS','salvarAtendimentoDoProntuario',[{visitaKey:h.randomUUID(),fichaId:ids.EX2,pacienteId:ids.patient,textoVisita:'QA tentativa sintética Carlos',eventosDraft:[],alertaNovo:null,ortoManutencao:null,destinoNovos:{fichaId:ids.EX2}}]),c=>{assert.equal(c.response.result.ok,false);assert.equal(c.after.tables.atendimentos_clinicos.count,c.before.tables.atendimentos_clinicos.count);assert.equal(c.after.tables.ficha_evolucoes.hash,c.before.tables.ficha_evolucoes.hash);});
   await check('E7 auditoria invisível Sara e protético',async()=>({sara:await rows(h.sessions.SARA.client.from('prontuario_exclusoes').select('*').eq('paciente_id',ids.patient)),protetico:await rows(h.sessions.PROTETICO.client.from('prontuario_exclusoes').select('*').eq('paciente_id',ids.patient))}),c=>{assert.equal(c.response.sara.length,0);assert.equal(c.response.protetico.length,0);noEffect(c);});
 }
 if(stage==='ui-matrix'||stage==='ui-matrix-3012'){
   const a=await login('ANA'),p=a.page;
   for(const width of [1440,390])for(const theme of ['light','dark'])for(const accepted of [false,true]){
     await p.setViewportSize({width,height:width===390?844:1000});await p.goto(base+'/dashboard/pacientes/'+ids.patient);await p.evaluate(theme=>localStorage.setItem('theme',theme),theme);await p.reload();
     await check(`UI 3012 ${width} ${theme} ${accepted?'aceito':'comum'}`,async c=>{
       await openFicha(p,accepted?ids.EXO:ids.EX2);const d=await openDelete(p);await d.waitFor();await fillDialog(d);
       c.theme=await p.locator('html').getAttribute('class');assert.equal(c.theme.includes('dark'),theme==='dark');
       c.checkboxCount=await d.getByRole('checkbox').count();assert.equal(c.checkboxCount,accepted?1:0);
       const button=d.getByRole('button',{name:'Apagar ficha',exact:true});assert.equal(await button.isDisabled(),accepted);
       if(accepted){await expect(d).toContainText('Esta ficha tem orçamento aceito pelo paciente');await d.getByRole('checkbox').focus();await p.keyboard.press('Space');await expect(button).toBeEnabled();await d.getByRole('checkbox').uncheck();await expect(button).toBeDisabled();}
       c.box=await d.boundingBox();c.viewport=await p.evaluate(()=>({width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth}));c.text=await d.innerText();await capture(p,`dialogo-${width}-${theme}-${accepted?'aceito':'comum'}`);
       assert(c.box.x>=-1&&c.box.x+c.box.width<=width+1,'Dialog horizontal overflow');assert(c.box.y>=-1&&c.box.y+c.box.height<=c.viewport.height+1,'Dialog exceeds viewport height');assert(c.viewport.scrollWidth<=width+1,'Page horizontal overflow');
       await d.getByRole('button',{name:'Cancelar',exact:true}).click();await openDelete(p);const fresh=p.getByRole('dialog',{name:'Apagar esta ficha?',exact:true});assert.equal(await fresh.getByRole('combobox').inputValue(),'');assert.equal(await fresh.getByRole('textbox',{name:/Para confirmar, digite o nome/}).inputValue(),'');if(accepted)await expect(fresh.getByRole('checkbox')).not.toBeChecked();return {layout:true,reset:true};
     },c=>{assert(c.response.layout&&c.response.reset);noEffect(c);});
     await p.keyboard.press('Escape');
   }
 }
 if(stage==='E1-E10-apagar'){
   const a=await login('ANA'),p=a.page;
   for(const [label,ficha]of [['E1 comum com visita',ids.EX1],['E10 simples sem orçamento',ids.EX2]]){
     await check(label+' UI apaga',async c=>{
       await openFicha(p,ficha);const d=await openDelete(p);await d.waitFor();assert.equal(await d.getByRole('checkbox').count(),0);await fillDialog(d);await expect(d.getByRole('button',{name:'Apagar ficha',exact:true})).toBeEnabled();await capture(p,label.split(' ')[0]+'-antes');c.sent=true;save();await d.getByRole('button',{name:'Apagar ficha',exact:true}).click();
       await expect.poll(async()=>rows(db.from('fichas').select('id').eq('id',ficha)),{timeout:20000}).toHaveLength(0);await p.reload();await p.getByRole('tab',{name:'Prontuário',exact:true}).click({timeout:20000});await capture(p,label.split(' ')[0]+'-depois');
       c.audit=await rows(a.client.from('prontuario_exclusoes').select('*').eq('paciente_id',ids.patient).eq('ficha_id',ficha));return {deleted:true};
     },c=>{
       assert(c.response.deleted);assert.equal(c.audit.length,1);assert(!JSON.stringify(c.audit).includes('QA-TEXTO-CLINICO'));assert.equal(c.after.tables.fichas.count,c.before.tables.fichas.count-1);
       if(ficha===ids.EX1){assert.equal(c.after.tables.atendimentos_clinicos.count,c.before.tables.atendimentos_clinicos.count-1);assert.equal(c.after.tables.odontograma_eventos.count,c.before.tables.odontograma_eventos.count-1);}
     });
   }
 }
 if(stage==='E8-aceito'){
   const a=await login('ANA'),p=a.page;
   await check('E8 aviso caixa e exclusão preserva financeiro',async c=>{
     await openFicha(p,ids.EXO);const d=await openDelete(p);await d.waitFor();await fillDialog(d);await expect(d.getByRole('checkbox')).not.toBeChecked();await expect(d.getByRole('button',{name:'Apagar ficha',exact:true})).toBeDisabled();
     await capture(p,'E8-sem-caixa');await d.getByRole('checkbox').check();await expect(d.getByRole('button',{name:'Apagar ficha',exact:true})).toBeEnabled();await capture(p,'E8-com-caixa');c.sent=true;save();await d.getByRole('button',{name:'Apagar ficha',exact:true}).click();
     await expect.poll(async()=>rows(db.from('fichas').select('id').eq('id',ids.EXO)),{timeout:20000}).toHaveLength(0);await p.reload();await p.getByRole('tab',{name:'Orçamentos',exact:true}).click({timeout:20000});
     await p.getByRole('button',{name:/^Abrir orçamento de/}).first().click({timeout:15000});const detail=p.getByRole('dialog',{name:'Orçamento',exact:true});c.patientBudgetText=await detail.innerText();await capture(p,'E8-orcamento-no-paciente');
     c.patientBudgetVisible=true;await detail.getByRole('button',{name:'Fechar',exact:true}).click();
     await p.goto(base+'/dashboard/orcamentos');await p.getByText('Paciente Exclusao QA',{exact:true}).first().waitFor({timeout:20000});c.globalText=await p.locator('body').innerText();await capture(p,'E8-orcamento-global');c.globalBudgetVisible=true;
     c.audit=await rows(a.client.from('prontuario_exclusoes').select('*').eq('paciente_id',ids.patient).eq('ficha_id',ids.EXO));return {preserved:true};
   },c=>{
     assert(c.response.preserved);const before=c.before.tables,after=c.after.tables;
     for(const t of ['assinaturas','pagamentos','orcamento_cobrancas','orcamento_cobranca_itens','orcamento_itens'])assert.equal(after[t].hash,before[t].hash,t+' changed');
     const old=before.orcamentos.rows.find(x=>x.id===ids.budget),now=after.orcamentos.rows.find(x=>x.id===ids.budget);assert(now);assert.equal(now.ficha_id,null);assert.equal(now.status,old.status);assert.equal(now.aprovado_em,old.aprovado_em);
     const doc=after.documentos_aceite.rows.find(x=>x.orcamento_id===ids.budget);assert(doc);assert.equal(doc.ficha_id,null);assert.equal(after.orcamento_eventos.rows.filter(x=>x.orcamento_id===ids.budget).length,0);assert.equal(c.audit.length,1);assert(!JSON.stringify(c.audit).includes('QA-TEXTO-CLINICO'));assert.equal(c.audit[0].resumo.confirmou_orcamento_aceito,true);
   });
 }
 if(stage==='E-RLS-fallback'){
   const a=await login('ANA'),carlos=await login('CARLOS'),p=a.page;
   await check('RLS real prévia zero sem visibilidade financeira',async c=>{
     c.anaPayments=await rows(a.client.from('pagamentos').select('id').eq('orcamento_id',ids.rlsBudget));c.anaCharges=await rows(a.client.from('orcamento_cobrancas').select('id').eq('orcamento_id',ids.rlsBudget));
     c.carlosPayments=await rows(carlos.client.from('pagamentos').select('id').eq('orcamento_id',ids.rlsBudget));c.carlosCharges=await rows(carlos.client.from('orcamento_cobrancas').select('id').eq('orcamento_id',ids.rlsBudget));
     assert.equal(c.anaPayments.length,0);assert.equal(c.anaCharges.length,0);assert.equal(c.carlosPayments.length,1);assert.equal(c.carlosCharges.length,1);
     await openFicha(p,ids.RLS,ids.extraPatient);const d=await openDelete(p);await d.waitFor();assert.equal(await d.getByRole('checkbox').count(),0);await fillDialog(d,{name:'QA M3 Extras 795872d 20261025',motivo:'outro',detail:'QA confirmação de exclusão'});await expect(d.getByRole('button',{name:'Apagar ficha',exact:true})).toBeEnabled();
     c.initialText=await d.innerText();await capture(p,'RLS-01-previa-sem-caixa');c.firstSent=true;save();await d.getByRole('button',{name:'Apagar ficha',exact:true}).click();
     await expect(d.getByRole('checkbox')).toBeVisible({timeout:15000});await expect(d).toContainText('Esta ficha tem orçamento ou pagamento que será mantido');await expect(d.getByRole('checkbox')).not.toBeChecked();await expect(d.getByRole('button',{name:'Apagar ficha',exact:true})).toBeDisabled();
     c.fallbackText=await d.innerText();c.nameRetained=await d.getByRole('textbox',{name:/Para confirmar, digite o nome/}).inputValue();c.reasonRetained=await d.getByRole('combobox').inputValue();c.detailRetained=await d.getByRole('textbox',{name:'Descreva em poucas palavras, sem dados clínicos',exact:true}).inputValue();
     assert.equal(c.nameRetained,'QA M3 Extras 795872d 20261025');assert.equal(c.reasonRetained,'outro');assert.equal(c.detailRetained,'QA confirmação de exclusão');assert(!c.fallbackText.includes('ainda não aceitou'));await capture(p,'RLS-02-caixa-recuperada');return {guarded:true};
   },c=>{assert(c.response.guarded);noEffect(c);});
   const preparation=e.cases.at(-1);if(preparation.status==='PASSOU')await check('RLS caixa recuperada permite exclusão consciente',async c=>{
     const d=p.getByRole('dialog',{name:'Apagar esta ficha?',exact:true});await d.getByRole('checkbox').focus();await p.keyboard.press('Space');await expect(d.getByRole('button',{name:'Apagar ficha',exact:true})).toBeEnabled();await capture(p,'RLS-03-confirmacao-explicita');c.sent=true;save();await d.getByRole('button',{name:'Apagar ficha',exact:true}).click();
     await expect.poll(async()=>rows(db.from('fichas').select('id').eq('id',ids.RLS)),{timeout:20000}).toHaveLength(0);await p.reload();await capture(p,'RLS-04-depois');c.budget=await rows(db.from('orcamentos').select('id,ficha_id,status,total').eq('id',ids.rlsBudget).single());assert.equal(c.budget.ficha_id,null);return {deleted:true};
   },c=>{assert(c.response.deleted);for(const t of ['pagamentos','orcamento_cobrancas','orcamento_cobranca_itens','orcamento_itens','assinaturas'])assert.equal(c.after.tables[t].hash,c.before.tables[t].hash,t+' changed');});
 }
 if(stage==='E8-orcamento-telas'){
   const a=await login('ANA'),p=a.page;
   await check('E8 orçamento guardado no paciente com aceite e financeiro',async c=>{
     await p.goto(base+'/dashboard/pacientes/'+ids.patient+'?tab=orcamentos');await p.getByRole('tab',{name:'Orçamentos',exact:true}).click({timeout:20000});await p.getByRole('button',{name:/^Abrir orçamento de/}).first().click({timeout:15000});const d=p.getByRole('dialog',{name:'Orçamento',exact:true});c.text=await d.innerText();await expect(d).toContainText('Aceite assinado por');await expect(d).toContainText('100');await capture(p,'E8-paciente-financeiro-preservado');
     await d.getByRole('button',{name:'Excluir',exact:true}).click();const blocked=p.getByRole('dialog',{name:'Excluir orçamento',exact:true});await expect(blocked).toContainText('tem aceite assinado pelo paciente e não pode ser excluído');c.buttons=await blocked.getByRole('button').allTextContents();assert.deepEqual(c.buttons.map(x=>x.trim()),['Fechar']);await capture(p,'E8-paciente-so-fechar');await blocked.getByRole('button',{name:'Fechar',exact:true}).click();return {protected:true};
   },c=>{assert(c.response.protected);noEffect(c);});
   await check('E8 orçamento guardado na tela global e bloqueio OD010',async c=>{
     await p.goto(base+'/dashboard/orcamentos');await p.getByRole('row').filter({hasText:'Paciente Exclusao QA'}).first().click({timeout:20000});const panel=p.locator('aside').last();c.panelText=await panel.innerText();await capture(p,'E8-global-financeiro-preservado');assert(c.panelText.includes('100'));
     await panel.getByRole('button',{name:'Excluir',exact:true}).click();const d=p.getByRole('dialog',{name:'Excluir orçamento?',exact:true});await d.waitFor();c.dialogText=await d.innerText();c.buttons=await d.getByRole('button').allTextContents();c.deleteAvailable=await d.getByRole('button',{name:'Excluir',exact:true}).isVisible();await capture(p,'E8-global-dialogo-excluir');
     // Never confirm deletion of the financial proof. Inspect and cancel only.
     const cancel=d.getByRole('button',{name:'Cancelar',exact:true});if(await cancel.isVisible())await cancel.click();else await d.getByRole('button',{name:'Fechar',exact:true}).click();return {onlyClose:!c.deleteAvailable};
   },c=>{assert(c.response.onlyClose,'Tela global oferece Excluir em orçamento com aceite; confirmação NÃO acionada');noEffect(c);});
 }
 if(stage==='E8-persistencia'){
   const a=await login('ANA'),previous=e.cases.find(c=>c.label==='E8 aviso caixa e exclusão preserva financeiro');assert(previous?.sent&&previous.patientBudgetVisible,'No deletion replay permitted');
   await check('E8 persistência e preservação após exclusão já enviada',async c=>{
     const current=await state(),before=previous.before.tables,after=current.tables;
     assert(!after.fichas.rows.some(f=>f.id===ids.EXO));
     for(const t of ['assinaturas','pagamentos','orcamento_cobrancas','orcamento_cobranca_itens','orcamento_itens'])assert.equal(after[t].hash,before[t].hash,t+' changed');
     const old=before.orcamentos.rows.find(x=>x.id===ids.budget),now=after.orcamentos.rows.find(x=>x.id===ids.budget);assert(now);assert.equal(now.ficha_id,null);assert.equal(now.status,old.status);assert.equal(now.aprovado_em,old.aprovado_em);
     const doc=after.documentos_aceite.rows.find(x=>x.orcamento_id===ids.budget);assert(doc);assert.equal(doc.ficha_id,null);assert.equal(after.orcamento_eventos.rows.filter(x=>x.orcamento_id===ids.budget).length,0);
     c.audit=await rows(a.client.from('prontuario_exclusoes').select('*').eq('paciente_id',ids.patient).eq('ficha_id',ids.EXO));assert.equal(c.audit.length,1);assert.equal(c.audit[0].resumo.confirmou_orcamento_aceito,true);assert(!JSON.stringify(c.audit).includes('QA-TEXTO-CLINICO'));return {verified:true};
   },c=>{assert(c.response.verified);noEffect(c);});
   if(e.cases.at(-1).status==='PASSOU'){previous.attemptStatus=previous.status;previous.status='NAO TESTADO';previous.harnessNote='Exclusão persistiu e orçamento abriu; só fechamento do modal interrompeu por dois botões Fechar. Nenhuma repetição de exclusão. Preservação verificada em caso separado somente leitura.';save();}
 }
 if(stage==='final'){
   const a=await login('ANA'),s=await login('SARA'),p=await login('PROTETICO'),b=await login('BRUNO');
   await check('Auditoria final sem texto clínico e leitura por papel',async c=>{
     c.ana=await rows(a.client.from('prontuario_exclusoes').select('*').in('paciente_id',[ids.patient,ids.extraPatient]).order('id'));assert(c.ana.length>=3);
     c.sara=await rows(s.client.from('prontuario_exclusoes').select('*').in('paciente_id',[ids.patient,ids.extraPatient]));c.protetico=await rows(p.client.from('prontuario_exclusoes').select('*').in('paciente_id',[ids.patient,ids.extraPatient]));c.bruno=await rows(b.client.from('prontuario_exclusoes').select('*').in('paciente_id',[ids.patient,ids.extraPatient]));assert.equal(c.sara.length,0);assert.equal(c.protetico.length,0);assert.equal(c.bruno.length,0);
     for(const audit of c.ana){assert(!JSON.stringify(audit.resumo).includes('QA-TEXTO-CLINICO'));assert(!JSON.stringify(audit.resumo).includes('procedimento sintetico'));assert(audit.excluido_por&&audit.excluido_por_usuario&&audit.created_at);}
     return {audited:true};
   },c=>{assert(c.response.audited);noEffect(c);});
   await a.page.goto(base+'/dashboard/orcamentos');await a.page.waitForURL(url=>url.pathname==='/dashboard/pacientes',{timeout:15000});e.globalRouteObserved={requested:'/dashboard/orcamentos',url:a.page.url(),reason:'Rota congelada redireciona para Pacientes; cliente legado não é renderizado.'};await capture(a.page,'E8-global-redireciona-pacientes');
   const oldGlobal=e.cases.find(c=>c.label==='E8 orçamento guardado na tela global e bloqueio OD010');if(oldGlobal){oldGlobal.attemptStatus=oldGlobal.status;oldGlobal.status='NAO TESTADO';oldGlobal.reason=e.globalRouteObserved.reason;}
   for(const old of e.cases.filter(c=>c.failure?.includes("locator.innerText")&&c.label.startsWith('OD021 ANA'))){old.attemptStatus=old.status;old.status='NAO TESTADO';old.harnessNote='Leitura do card após abrir modal não resolve por background inert. Ajustada para ler antes; rodada r2 passou sem escrita de negócio.';}
   e.final=await state();assert.equal(e.final.permanent,e.seedInitial.permanent,'ES/patient not intact');e.finalHead=h.execFileSync('git',['rev-parse','HEAD'],{cwd:h.runtimeRoot,encoding:'utf8'}).trim();assert(e.finalHead.startsWith('e5d7ede'));
   e.finalSourceProof=e.sourceProof.map(x=>({path:x.path,same:hash(h.fs.readFileSync(h.path.join(h.runtimeRoot,x.path),'utf8').replaceAll('\r\n','\n'))===x.hash}));assert(e.finalSourceProof.every(x=>x.same));
   e.od021.withoutDentist={status:'NAO TESTADO',reason:'Seed com dentista_id NULL recusada pelo odonto-qa com 23502 NOT NULL; transação revertida. Schema não alterado. Teste JSX local null/undefined passou, distinto de prova Auth/UI.'};
   e.finished=new Date().toISOString();save();console.log('PASSOU inventário e permanente final');
 }
 if(stage==='ui-delivery-inventory'){
   const patient='e0210000-0000-4000-8000-000000000001';
   const budgets=await rows(db.from('orcamentos').select('*').eq('paciente_id',patient).order('id'));
   e.od021.inventory={patients:await rows(db.from('pacientes').select('*').eq('id',patient)),budgets,items:await rows(db.from('orcamento_itens').select('*').in('orcamento_id',budgets.map(b=>b.id)).order('id'))};
   e.delivery={time:new Date().toISOString(),base,head:h.runtimeHead,noCleanup:true};save();console.log('PASSOU inventário de entrega somente leitura');
 }
}
