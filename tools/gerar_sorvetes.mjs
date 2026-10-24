// Gera os modelos de vitrine (cartões do cardápio) dos recipientes de sorvete e milkshake.
// Uso: node tools/gerar_sorvetes.mjs
import { montarSorvete } from '../public/sorvete.mjs';
import { writeFileSync } from 'fs';
const casos = {
  'sorvete-casquinha': { recipiente: 'casquinha', sabores: ['morango', 'chocolate'], coberturas: ['calda_chocolate', 'granulado'] },
  'sorvete-cascao': { recipiente: 'cascao', sabores: ['flocos', 'menta', 'morango'], coberturas: ['calda_morango'] },
  'sorvete-taca': { recipiente: 'taca', sabores: ['creme', 'chocolate', 'morango'], coberturas: ['calda_caramelo', 'chantilly', 'cereja', 'wafer'] },
  'sorvete-copinho': { recipiente: 'copinho', sabores: ['pistache', 'creme'], coberturas: ['amendoim'] },
  'milkshake-500': { recipiente: 'milkshake', sabores: ['chocolate'], coberturas: ['chantilly', 'calda_chocolate', 'cereja'] },
  'milkshake-300': { recipiente: 'milkshake300', sabores: ['morango'], coberturas: ['chantilly', 'calda_morango', 'cereja'] }
};
for (const [nome, o] of Object.entries(casos)) {
  const glb = montarSorvete({ ...o, leve: true });
  writeFileSync(new URL('../public/assets/models/' + nome + '.glb', import.meta.url), glb);
  console.log(nome, Math.round(glb.length / 1024) + ' KB');
}
