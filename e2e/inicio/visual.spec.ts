import {test,expect,before,login,inicio,capture,theme} from './support';
test.describe.configure({retries:0,timeout:120000});
for(const role of ['ANA','SECRETARIA'] as const) {
  test('visual ' + role + ' 1440 900 390 claro escuro',async({page},info)=>{
    test.setTimeout(240000);
    await login(page,role); await inicio(page);
    for(const width of [1440,900,390]) for(const dark of [false,true]) {
      await page.setViewportSize({width:1440,height:900}); await theme(page,dark); await page.setViewportSize({width,height:900});
      const label='OD-005b-'+role.toLowerCase()+'-'+width+'-'+(dark?'escuro':'claro')+'-'+(before?'antes':'depois');
      const measurement=await capture(page,info,label);
      expect(measurement.scrollWidth,label+' overflow horizontal').toBeLessThanOrEqual(width);
      if(!before) {
        await expect(page.locator('h1').first()).toHaveCSS('font-size','32px');
        const size=await page.locator('h1').first().boundingBox();
        expect(size?.width).toBeLessThanOrEqual(width);
      }
    }
  });
}
