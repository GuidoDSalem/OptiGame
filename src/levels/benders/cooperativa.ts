import type { VarianteBenders } from './template';

/** Versión "Cooperativa": la cooperativa láctea del nivel 3 decide qué depósitos abrir. */
export const cooperativa: VarianteBenders = {
  id: 'benders-cooperativa',
  variant: 'Cooperativa',
  title: 'Depósitos para la cooperativa',
  client: 'Cooperativa láctea',
  // Coordenadas en un mapa de la región (unidades de ~20 km).
  depositos: [
    { id: 'raf', label: 'Depósito Rafaela', short: 'D. Rafaela', x: 2, y: 6, costoFijo: 40, capacidad: 40 },
    { id: 'sfe', label: 'Depósito Santa Fe', short: 'D. Santa Fe', x: 6, y: 5, costoFijo: 55, capacidad: 60 },
    { id: 'ros', label: 'Depósito Rosario', short: 'D. Rosario', x: 7, y: 1, costoFijo: 70, capacidad: 80 },
    { id: 'cba', label: 'Depósito Córdoba', short: 'D. Córdoba', x: 0, y: 2, costoFijo: 50, capacidad: 50 },
    { id: 'ven', label: 'Depósito Venado Tuerto', short: 'D. Venado', x: 4, y: 0, costoFijo: 30, capacidad: 30 },
  ],
  clientes: [
    { id: 'rosC', label: 'Rosario', short: 'Rosario', x: 8, y: 1, demanda: 25 },
    { id: 'sfeC', label: 'Santa Fe', short: 'Santa Fe', x: 6, y: 6, demanda: 15 },
    { id: 'cbaC', label: 'Córdoba', short: 'Córdoba', x: 0, y: 1, demanda: 20 },
    { id: 'par', label: 'Paraná', short: 'Paraná', x: 7, y: 6, demanda: 10 },
    { id: 'rafC', label: 'Rafaela', short: 'Rafaela', x: 2, y: 7, demanda: 8 },
    { id: 'venC', label: 'Venado Tuerto', short: 'Venado', x: 4, y: -1, demanda: 7 },
    { id: 'vma', label: 'Villa María', short: 'V. María', x: 2, y: 3, demanda: 12 },
  ],
  costoPorDistancia: 1,
  historia: [
    {
      type: 'p',
      text: 'La cooperativa **Tambo Unido** creció: ahora abastece a siete ciudades y quiere dejar de mandar camiones desde las plantas. La idea es abrir **depósitos regionales**. Hay cinco lugares candidatos. Cada depósito abierto tiene un **costo fijo semanal** (alquiler, personal, frío) y una **capacidad** máxima de camiones por semana.',
    },
    {
      type: 'p',
      text: 'Abrir muchos depósitos acorta los viajes pero cuesta caro. Abrir pocos ahorra en alquileres pero alarga el reparto. ¿Cuáles conviene abrir?',
    },
  ],
};
