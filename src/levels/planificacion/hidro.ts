import { crearEscenaLineaDeTiempo } from './Scene';
import type { Periodo, VariantePlanificacion } from './template';

const periodos: Periodo[] = [
  { id: 'f1', label: 'Franja 0–4 h', short: '0–4', demanda: 0, capacidad: 60, costo: 20 },
  { id: 'f2', label: 'Franja 4–8 h', short: '4–8', demanda: 0, capacidad: 60, costo: 30 },
  { id: 'f3', label: 'Franja 8–12 h', short: '8–12', demanda: 60, capacidad: 40, costo: 60 },
  { id: 'f4', label: 'Franja 12–16 h', short: '12–16', demanda: 30, capacidad: 40, costo: 55 },
  { id: 'f5', label: 'Franja 16–20 h', short: '16–20', demanda: 90, capacidad: 20, costo: 95 },
  { id: 'f6', label: 'Franja 20–24 h', short: '20–24', demanda: 40, capacidad: 40, costo: 70 },
];

const capStock = 100;

/**
 * Versión "Hidroeléctrica": central de bombeo. Con energía barata se bombea agua al embalse
 * de arriba; en las horas caras se la deja caer para generar y cumplir con la red.
 */
export const hidro: VariantePlanificacion = {
  id: 'planificacion-hidro',
  variant: 'Hidroeléctrica',
  title: 'Agua que vale energía',
  client: 'Central hidroeléctrica',
  periodos,
  costoFijo: 500,
  costoStock: 2,
  capStock,
  scene: crearEscenaLineaDeTiempo({
    periodos,
    capStock,
    estilo: 'hidro',
    labels: { envio: 'Bombeo', stock: 'Embalse', demanda: 'Red', origen: 'Río' },
  }),
  vocab: {
    periodo: { singular: 'franja', plural: 'franjas', la: 'la franja', una: 'una franja', pocas: 'pocas franjas' },
    unidad: 'MWh',
    moneda: 'US$',
    x: 'Energía bombeada',
    s: 'Agua en el embalse',
    z: 'Bombas encendidas',
    demanda: 'Entrega a la red',
    capacidad: 'Capacidad de bombeo',
    costo: 'Precio de la energía',
    costoFijo: 'Arrancar las bombas',
    fijoAMedias: 'arrancar "0,4 bombas"',
    costoStock: 'Pérdidas del embalse',
    capStock: 'Capacidad del embalse',
    faltante: (t, q) => `En la ${t} la central entregó ${q} MWh de menos: multa del operador de la red.`,
    excesoCap: (t) => `En la ${t} las bombas no dan para subir tanta agua.`,
    excesoStock: (t) => `En la ${t} el embalse rebalsa por el vertedero: agua (y plata) perdida.`,
    sinFijo: (t) => `En la ${t} bombeaste sin arrancar las bombas. ¿Falta la restricción de activación?`,
    fijoParcial: (t, z) => `En la ${t} arrancaste "${z} bombas": se arrancan o no se arrancan. ¿z es binaria?`,
  },
  historia: [
    {
      type: 'p',
      text: 'La central de bombeo **Cerro Azul** tiene dos embalses, uno arriba y otro abajo. Cuando la energía está barata, usa bombas para **subir agua** al embalse de arriba. Cuando está cara, la deja caer por las turbinas para **generar**. Es una batería gigante hecha de agua.',
    },
    {
      type: 'p',
      text: 'Mañana la central se comprometió a entregar energía a la red en varias franjas horarias. Tenés que decidir **cuánto bombear en cada franja** para tener agua arriba cuando haga falta. El embalse arranca vacío. Para simplificar, cada MWh bombeado se devuelve como 1 MWh generado.',
    },
    {
      type: 'p',
      text: 'El precio de la energía cambia mucho a lo largo del día, y en la franja pico (16–20 h) la red pide más de lo que las bombas pueden subir en esas mismas horas.',
    },
  ],
};
