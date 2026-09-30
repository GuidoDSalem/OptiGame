import { RedDiagrama } from './graficos';
import { RED } from './planta';

/** Miniatura del menú: la red con la bulonera caída. */
export function MiniaturaResiliencia() {
  return <RedDiagrama red={RED} caido="bsj" compacto animada={false} />;
}
