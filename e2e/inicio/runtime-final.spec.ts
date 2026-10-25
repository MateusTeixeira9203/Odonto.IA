import {test,expect,login,inicio,baseURL,evidence,capture} from './support';

test.describe.configure({retries:0,timeout:120000});
for(const role of ['ANA','ADMIN'] as const){
  test('runtime reload Inicio '+role,async({page},info)=>{
    const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
    await login(page,role);await inicio(page);
    const heading=await page.locator('h1').first().innerText();
    await page.reload();await expect(page.locator('h1').first()).toHaveText(heading,{timeout:60000});
    await expect(page.getByText('Consultas hoje',{exact:true})).toBeVisible();
    const state=await capture(page,info,'runtime-reload-'+role+'-'+new URL(baseURL).port);
    await info.attach('runtime-errors',{body:JSON.stringify({errors,state}),contentType:'application/json'});
    expect(errors).toEqual([]);
  });
  test('runtime Financeiro privado no Inicio '+role,async({page},info)=>{
    await login(page,role);await inicio(page);
    const toggle=page.getByRole('button',{name:/^(Ocultar valores|Revelar valores)$/});
    const count=await toggle.count();
    await info.attach('disponibilidade-financeiro',{body:JSON.stringify({baseURL,role,count,heading:await page.getByRole('heading',{name:'Saúde Financeira',exact:true}).count()}),contentType:'application/json'});
    if(evidence)await page.screenshot({path:evidence+'/runtime-financeiro-'+role+'-'+new URL(baseURL).port+'.png',animations:'disabled'});
    test.skip(count===0,'FinanceiroHub não renderizado no Início desta versão/conta; toggle NÃO TESTADO.');
    const button=toggle.first();
    await expect(button).toHaveAttribute('aria-pressed','false');await button.click();
    await expect(button).toHaveAttribute('aria-pressed','true');
    await expect(button).toHaveAttribute('title','Revelar valores');
    await page.reload();await expect(page.getByRole('button',{name:'Revelar valores'})).toHaveAttribute('aria-pressed','true');
    await page.getByRole('button',{name:'Revelar valores'}).click();
    await expect(page.getByRole('button',{name:'Ocultar valores'})).toHaveAttribute('aria-pressed','false');
  });
  test('runtime Primeiros passos no Inicio '+role,async({page},info)=>{
    await login(page,role);await inicio(page);
    const title=page.getByText('Primeiros passos',{exact:true});const count=await title.count();
    await info.attach('disponibilidade-primeiros-passos',{body:JSON.stringify({baseURL,role,count}),contentType:'application/json'});
    test.skip(count===0,'PrimeirosPassosCard não renderizado; interação NÃO TESTADA.');
    await expect(title).toBeVisible();
    await expect(page.getByRole('button',{name:'Dispensar primeiros passos',exact:true})).toBeVisible();
    await page.reload();await expect(title).toBeVisible();
  });
}
