# Odonto.IA — visão de produto

STATUS: ACTIVE
OWNER: Produto — decisões do usuário, consolidação pela Coordenação
LAST_REVIEWED: 2026-10-11
REPLACES: visão centrada exclusivamente na consulta; oferta solo/colaborativa para novos clientes; docs/ESTRATEGIA-PRODUTO.md
CANONICAL_FOR: público, posicionamento, responsabilidades das capacidades e limites de evolução

Este documento registra direção de produto, não comprova funcionalidades implantadas.
Regras técnicas estão no [AGENTS](../AGENTS.md), versão publicada na
[baseline](../01_BASELINE_E_ESTABILIDADE.md) e foco no [Estado](../plans/ESTADO.md).
As decisões vêm da conversa de 11/10/2026; propostas e lacunas estão identificadas.

## Produto e público — decidido

**Software de gestão para clínicas odontológicas geridas, com atendimento clínico integrado
e documentação assistida por IA.**

O cliente principal passa a ser a clínica com proprietário e gestão definida. O proprietário
pode ser dentista que atende, dentista que só administra ou pessoa não dentista. O dentista
continua sendo usuário central do atendimento; ampliar a gestão deve preservar sua experiência.

Uma clínica com um único dentista também é clínica: a mesma pessoa acumula os papéis de
proprietário e dentista, utiliza gestão e atendimento e pode convidar equipe no futuro.
Essa acumulação não dispensa limites por papel e por clínica.

Na direção da nova oferta, não haverá plano Solo nem entrada de novas clínicas colaborativas.
Preço, cobrança, limites dos planos e transição técnica/comercial ainda exigem definição própria.

**Exceções legadas confirmadas pelo usuário:** Clindent permanece colaborativa; Dra. Léia
permanece na configuração solo existente. Ambas mantêm seus fluxos atuais. Os nomes são
referências de negócio, não identificadores de banco. Nenhuma migração, cancelamento de plano,
remoção de acesso ou alteração de dados está autorizada por esta decisão documental.

## Valor esperado por papel

| Papel | Resultado que o produto deve favorecer |
| --- | --- |
| Proprietário/gestor | Entender a operação e os números da clínica, identificar problemas e tomar decisões verificáveis. |
| Proprietário que atende | Alternar gestão e atendimento conforme seus papéis, sem registrar o mesmo fato duas vezes. |
| Dentista da equipe | Atender com fluidez, revisar a documentação assistida por IA e acompanhar o trabalho sob sua responsabilidade. |
| Recepção e apoio | Executar suas tarefas com contexto suficiente e acesso limitado ao necessário. |

Propriedade, vínculo com a clínica, responsabilidade pela cobrança e autorização clínica são
conceitos distintos. Ser proprietário não concede automaticamente edição de prontuários de
outros profissionais; ser proprietário não dentista não concede atuação clínica. A matriz de
leitura, edição, aprovação e exportação por papel deverá ser explicitada antes de implementação.

## Atual, desejado e lacuna

| Tema | O que sabemos agora | Direção / lacuna |
| --- | --- | --- |
| Atendimento clínico | O usuário considera o produto útil e bom para dentistas; é relato de uso, não auditoria completa. | Preservar o que funciona e verificar entradas, processamento, persistência e recuperação de falhas. |
| Versão de referência | A versão publicada foi identificada no documento de baseline. | Identificação de SHA não prova estabilidade, segurança ou paridade do banco. |
| Gestão para proprietário | Novo foco decidido nesta conversa. | Inventariar o comportamento real antes de classificar capacidades como prontas, ausentes ou incompletas. |
| Oferta solo/colaborativa | Excluída da direção de aquisição; duas exceções preservadas. | Levantar onboarding, planos, vínculos e permissões antes de propor a transição. |
| Necessidades de gestão | Há temas propostos pelo usuário e pesquisa inicial de concorrentes. | Ouvir três dentistas e incluir perspectiva de proprietário que não atende. |

## Núcleo clínico a preservar

Captura → estruturação pela IA → Ficha → planejamento → orçamento, com continuidade nos
fluxos existentes de agenda, pacientes e financeiro. A Ficha estruturada é um ativo do produto.
Não substituir jornadas funcionais por uma reorganização de gestão sem inventário e regressão.

A IA organiza e reduz trabalho documental; o profissional revisa o conteúdo. Não inventa
diagnóstico nem assume decisão clínica. Dex é a identidade dessa assistência operacional,
com respostas claras e previsíveis. Planejamento e apresentação ajudam o paciente a entender
o tratamento; decisões comerciais não devem alterar o registro clínico silenciosamente.

A gestão deve consumir os mesmos fatos de atendimento, produção e pagamento, respeitando
suas diferenças e autorizações. Não criar controles paralelos que exijam recadastro manual.

## Capacidades de gestão a investigar

Este mapa define responsabilidades; não é roadmap, lista de telas ou aprovação de entrega.
A [pesquisa e roteiro de entrevistas](../memory/references/gestao-clinicas-geridas-2026-10-11.md)
concentra fontes, perguntas, hipóteses e método de priorização.

| Capacidade | Responsabilidade / decisão a apoiar | Definição ainda necessária |
| --- | --- | --- |
| Financeiro da clínica e por dentista | Entender entradas, saídas, valores a receber e atribuição aos profissionais. | Separar orçamento, produção, recebimento, repasse e despesas; regras, visibilidade e conciliação. |
| Capacidade e hora clínica | Entender disponibilidade, ocupação e resultado associado ao tempo de atendimento. | Distinguir tempo disponível/agendado/realizado, custo por hora e receita por hora. |
| Estoque | Entender disponibilidade, consumo, reposição e perdas. | Quem registra, unidade de consumo, vínculo com procedimentos e necessidade de lotes/validade. |
| Contratos | Organizar documentos, responsáveis e acompanhamento dos acordos. | Contratos com pacientes, profissionais ou ambos; versões, assinatura e integrações. |
| Equipe, configurações e permissões | Definir quem pode ver e executar cada ação da clínica. | Convite, saída, troca de responsabilidade e limites por papel; preservar legado. |
| WhatsApp da clínica | Organizar comunicação e continuidade do atendimento pela equipe. | Caixa compartilhada, responsáveis, confirmações, retornos e cobranças: validar necessidade e integrações. |

Ticket médio precisa de evento-base, período e denominador explícitos. “Hora clínica” pode
significar custo, receita ou disponibilidade; não deve virar um único número ambíguo.
“Folga” precisa ser esclarecida nas entrevistas: tempo ocioso, capacidade para encaixes ou
margem financeira. Recebimento, produção e lucro não são sinônimos. Fórmulas e fontes de
dados só serão fechadas no contrato do recorte escolhido.

## Sequência de evolução

1. **Estabilizar o produto existente — prioridade decidida.** Inventariar as jornadas e
   verificar segurança, entradas, tratamento de dados, persistência, erros e retomada. Dividir
   o pente-fino em marcos verificáveis, com evidências por critério e proteção das duas exceções.
2. **Descobrir necessidades de gestão.** Pesquisa documental e entrevistas podem avançar
   durante a estabilização, sem antecipar implementação. Separar problema observado, sugestão
   do entrevistado e hipótese nossa. Três conversas orientam o primeiro recorte, não comprovam mercado.
3. **Expandir por recortes aprovados.** Depois dos gates pertinentes de estabilidade, escolher
   uma necessidade, inventariar o que já existe, fechar contrato e verificar ponta a ponta.

A auditoria ainda precisa de contrato e cobertura acordados; esta visão não a declara iniciada
nem concluída. Achados de segurança confirmados pedem contenção própria, sem esperar toda
a reorganização. Critérios de regressão permanecem nas specs dos itens, conforme a governança.

## Hipótese de diferenciação e recomendação

Diretriz reforçada pelo usuário em 11/10: buscar gestão abrangente, melhorando a experiência
das capacidades encontradas nos concorrentes. O elogio relatado — “feito com um dentista para
um dentista” — é o princípio a preservar e estender à rotina do proprietário e da equipe.
Abrangência é ambição de produto, não autorização para implementar todas as funções em lote.
Mapear capacidades concorrentes, entender a decisão que cada uma apoia e simplificar sua
operação; registrar lacunas de cobertura e validar prioridades, sem confundir completude
com quantidade de telas. A pesquisa inicial de três fornecedores não é inventário exaustivo.

A pesquisa encontrou ofertas de gestão odontológica e documentação por voz com IA. Portanto,
“ter gestão” ou “ter IA” não demonstra exclusividade. **Hipótese a validar:** o Odonto.IA pode
unir atendimento fluido a números confiáveis e compreensíveis para o proprietário, com menos
retrabalho entre equipe clínica e administrativa.

**Recomendação do coordenador, ainda não escopo aprovado:** investigar primeiro financeiro
por clínica/profissional e capacidade de atendimento. Essas perguntas aproximam o novo público
dos fatos já produzidos no atendimento. O risco é construir indicadores sobre registros
incompletos; por isso, sua qualidade e rastreabilidade precedem um painel gerencial.

Alternativa: expandir todos os módulos de gestão simultaneamente. Aumenta a abrangência, mas
também a superfície de regressão e o risco de construir demandas não confirmadas. Manter apenas
o posicionamento clínico reduziria o esforço, mas não atende à direção escolhida pelo usuário.

## Limites e decisões em aberto

- Primeiro problema de gestão e momento de valor para o proprietário que não atende.
- Permissões e fronteiras dos dados financeiros/clínicos, inclusive o que cada dentista vê.
- Modelo comercial e transição do cadastro de novos clientes; exceções legadas já definidas.
- Integrações, automações, métricas e contratos específicos ainda sem homologação neste ciclo.
- Auditoria funcional não executada nesta etapa documental; nenhum módulo ganhou status de pronto.

Direção visual: clareza, consistência e baixa carga cognitiva. A referência global continua
pendente; artefatos aprovados do item e regras de tokens estão no AGENTS e protocolo 06.
PWA permanece a direção de acesso atual; aplicativo nativo não é compromisso desta fase.

Filtro de evolução: **isso melhora o atendimento ou a gestão para o papel certo, com dados
confiáveis e sem comprometer os fluxos existentes?**
