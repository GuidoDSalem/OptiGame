import { crearEscenaLineaDeTiempo } from './Scene';
import type { Periodo, VariantePlanificacion } from './template';

const periodos: Periodo[] = [
  { id: 's1', label: 'Semana 1', short: 'S1', demanda: 0, capacidad: 50, costo: 8 },
  { id: 's2', label: 'Semana 2', short: 'S2', demanda: 40, capacidad: 50, costo: 9 },
  { id: 's3', label: 'Semana 3', short: 'S3', demanda: 0, capacidad: 25, costo: 11 },
  { id: 's4', label: 'Semana 4', short: 'S4', demanda: 60, capacidad: 40, costo: 12 },
  { id: 's5', label: 'Semana 5', short: 'S5', demanda: 30, capacidad: 20, costo: 13 },
  { id: 's6', label: 'Semana 6', short: 'S6', demanda: 50, capacidad: 40, costo: 14 },
];

const capStock = 45;

/** Versión "Minera": mineral en tren de la mina al puerto, donde cargan los barcos. */
export const minera: VariantePlanificacion = {
  id: 'planificacion-minera',
  variant: 'Minera',
  title: 'Mineral a tiempo',
  client: 'Minera y puerto',
  periodos,
  costoFijo: 150,
  costoStock: 2,
  capStock,
  scene: crearEscenaLineaDeTiempo({
    periodos,
    capStock,
    labels: { envio: 'Tren', stock: 'Stock en puerto', demanda: 'Barcos', origen: 'Mina' },
  }),
  vocab: {
    periodo: { singular: 'semana', plural: 'semanas', la: 'la semana', una: 'una semana', pocas: 'pocas semanas' },
    unidad: 'kt',
    moneda: '$k',
    x: 'Mineral enviado',
    s: 'Stock en el puerto',
    z: 'Tren contratado',
    demanda: 'Carga de barcos',
    capacidad: 'Capacidad de la mina',
    costo: 'Extracción y flete',
    costoFijo: 'Contratar el tren',
    fijoAMedias: 'alquilar "0,4 trenes"',
    costoStock: 'Guardar en el puerto',
    capStock: 'Capacidad del puerto',
    faltante: (t, q) => `El barco de la ${t} zarpó con ${q} kt de menos: penalidad del cliente.`,
    excesoCap: (t) => `En la ${t} la mina no da para extraer tanto.`,
    excesoStock: (t) => `En la ${t} el puerto se desborda: no hay dónde apilar el mineral.`,
    sinFijo: (t) => `En la ${t} mandaste mineral sin contratar el tren. ¿Falta la restricción de activación?`,
    fijoParcial: (t, z) => `En la ${t} contrataste "${z} trenes": el tren se contrata entero o no se contrata. ¿z es binaria?`,
  },
  historia: [
    {
      type: 'p',
      text: 'La minera **Cerro Alto** manda mineral en tren hasta el puerto, donde llegan barcos a cargar. Tenés que planificar las próximas **6 semanas**: cuánto mandar cada semana para que ningún barco zarpe con la bodega a medias.',
    },
    {
      type: 'p',
      text: 'Hay dos semanas de **mantenimiento** (S3 y S5) en las que la mina produce menos, y el costo de extracción sube semana a semana. Ojo: en la S6 el barco pide más de lo que la mina puede extraer en una semana.',
    },
  ],
};
