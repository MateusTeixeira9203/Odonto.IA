import config from './playwright.config.mjs';
const assinaturaConfig={...config,testIgnore:[],testMatch:'zz-final-assinaturas.spec.mjs'};
export default assinaturaConfig;
