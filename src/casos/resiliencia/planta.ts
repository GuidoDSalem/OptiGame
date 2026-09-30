import type { Red, Sitio } from '../../engine/resiliencia';
import type { Opciones } from './analisis';

/**
 * Caso C3: una fábrica de maquinaria agrícola de Córdoba (ficticia) y su red de proveedores.
 * Todos los números del caso viven acá. Unidades por semana; dinero en US$.
 */

const proveedor = (id: string, nombre: string, corto: string, lugar: string, nivel: 1 | 2, ttr: number, produce: Sitio['produce']): Sitio => ({
  id,
  nombre,
  corto,
  lugar,
  tipo: 'proveedor',
  nivel,
  ttr,
  produce,
});

export const RED: Red = {
  tasaStock: 0.25,
  horizonte: 52,
  items: [
    // Productos: demanda por semana y margen por unidad.
    { id: 'sg', nombre: 'Sembradora grande', tipo: 'producto', unidad: 'u', costo: 0, stock: 0, demanda: 6, margen: 40000, bom: { chasis: 1, caja: 2, cilindro: 4, monitor: 1, neumatico: 4, disco: 24, bulon: 400, pintura: 60 } },
    { id: 'sc', nombre: 'Sembradora chica', tipo: 'producto', unidad: 'u', costo: 0, stock: 0, demanda: 10, margen: 18000, bom: { chasis: 1, caja: 1, cilindro: 2, monitor: 1, neumatico: 2, disco: 12, bulon: 250, pintura: 35 } },
    { id: 'fe', nombre: 'Fertilizadora', tipo: 'producto', unidad: 'u', costo: 0, stock: 0, demanda: 8, margen: 9000, bom: { chasis: 1, caja: 1, neumatico: 2, bulon: 150, pintura: 25 } },
    // Piezas: costo y stock en la planta (unidades) al momento de la caída.
    { id: 'chasis', nombre: 'Chasis', tipo: 'pieza', unidad: 'u', costo: 9000, stock: 36, bom: { acero: 1.2 } },
    { id: 'caja', nombre: 'Caja de engranajes', tipo: 'pieza', unidad: 'u', costo: 2500, stock: 180 },
    { id: 'cilindro', nombre: 'Cilindro hidráulico', tipo: 'pieza', unidad: 'u', costo: 600, stock: 88 },
    { id: 'monitor', nombre: 'Monitor de siembra', tipo: 'pieza', unidad: 'u', costo: 3200, stock: 48, bom: { chip: 1 } },
    { id: 'neumatico', nombre: 'Neumático', tipo: 'pieza', unidad: 'u', costo: 350, stock: 120 },
    { id: 'disco', nombre: 'Disco de siembra', tipo: 'pieza', unidad: 'u', costo: 90, stock: 1584, bom: { acero: 0.01 } },
    { id: 'bulon', nombre: 'Bulón grado 10.9', tipo: 'pieza', unidad: 'u', costo: 0.9, stock: 6100 },
    { id: 'pintura', nombre: 'Pintura en polvo', tipo: 'pieza', unidad: 'kg', costo: 12, stock: 2730 },
    // Materiales de los proveedores (nivel 2): el stock está en sus depósitos.
    { id: 'acero', nombre: 'Acero plano', tipo: 'material', unidad: 't', costo: 900, stock: 94 },
    { id: 'chip', nombre: 'Microcontrolador', tipo: 'material', unidad: 'u', costo: 400, stock: 80 },
  ],
  sitios: [
    { id: 'lv', nombre: 'Planta Las Varillas', corto: 'Las Varillas', lugar: 'Las Varillas, Córdoba', tipo: 'planta', nivel: 0, ttr: 16, capTotal: 14, produce: { sg: { cap: 14, normal: 6 }, sc: { cap: 14, normal: 6 } } },
    { id: 'mj', nombre: 'Planta Marcos Juárez', corto: 'Marcos Juárez', lugar: 'Marcos Juárez, Córdoba', tipo: 'planta', nivel: 0, ttr: 16, capTotal: 14, produce: { sc: { cap: 14, normal: 4 }, fe: { cap: 14, normal: 8 } } },
    proveedor('mdc', 'Metalúrgica del Centro', 'Met. del Centro', 'Córdoba', 1, 3, { chasis: { cap: 22, normal: 16 } }),
    proveedor('ery', 'Estructuras Rafaela', 'Estr. Rafaela', 'Rafaela, Santa Fe', 1, 3, { chasis: { cap: 16, normal: 8 } }),
    proveedor('rie', 'Riduttori Emilia', 'Riduttori (Italia)', 'Módena, Italia', 1, 12, { caja: { cap: 36, normal: 30 } }),
    proveedor('epr', 'Electrónica Precisión', 'Electr. Precisión', 'Rosario, Santa Fe', 1, 6, { monitor: { cap: 20, normal: 16 } }),
    proveedor('hro', 'Hidráulica Rosario', 'Hidr. Rosario', 'Rosario, Santa Fe', 1, 5, { cilindro: { cap: 50, normal: 34 } }),
    proveedor('oht', 'Oleohidráulica Tandil', 'Oleohidr. Tandil', 'Tandil, Buenos Aires', 1, 5, { cilindro: { cap: 20, normal: 10 } }),
    proveedor('dbr', 'Discos do Brasil', 'Discos do Brasil', 'Caxias do Sul, Brasil', 1, 5, { disco: { cap: 300, normal: 264 } }),
    proveedor('npa', 'Neumáticos Pampeanos', 'Neum. Pampeanos', 'Merlo, Buenos Aires', 1, 4, { neumatico: { cap: 60, normal: 45 } }),
    proveedor('nsi', 'Neumáticos del Sur (importador)', 'Neum. del Sur', 'Bahía Blanca, Buenos Aires', 1, 4, { neumatico: { cap: 40, normal: 15 } }),
    proveedor('pco', 'Pinturas Córdoba', 'Pint. Córdoba', 'Córdoba', 1, 3, { pintura: { cap: 1000, normal: 600 } }),
    proveedor('pba', 'Pinturas Buenos Aires', 'Pint. Bs. As.', 'Avellaneda, Buenos Aires', 1, 3, { pintura: { cap: 800, normal: 310 } }),
    proveedor('bsj', 'Bulonera San Justo', 'Bulonera San Justo', 'San Justo, Santa Fe', 1, 9, { bulon: { cap: 7000, normal: 6100 } }),
    proveedor('apa', 'Acería del Paraná', 'Acería del Paraná', 'Villa Constitución, Santa Fe', 2, 6, { acero: { cap: 60, normal: 31.44 } }),
    proveedor('sca', 'Semiconductores Asia', 'Semic. Asia', 'Hsinchu, Taiwán', 2, 14, { chip: { cap: 40, normal: 16 } }),
  ],
  acciones: [
    { id: 'st-bulon', tipo: 'stock', item: 'bulon', nombre: 'Más stock de bulones' },
    { id: 'st-chip', tipo: 'stock', item: 'chip', nombre: 'Más chips en el depósito de Electrónica Precisión' },
    { id: 'st-monitor', tipo: 'stock', item: 'monitor', nombre: 'Más stock de monitores' },
    { id: 'st-acero', tipo: 'stock', item: 'acero', nombre: 'Más acero en los depósitos de las metalúrgicas' },
    { id: 'st-cilindro', tipo: 'stock', item: 'cilindro', nombre: 'Más stock de cilindros' },
    { id: 'st-caja', tipo: 'stock', item: 'caja', nombre: 'Más stock de cajas' },
    { id: 'st-chasis', tipo: 'stock', item: 'chasis', nombre: 'Más stock de chasis' },
    {
      id: 'f-bulon',
      tipo: 'fuente',
      nombre: 'Homologar una segunda bulonera',
      costoAnual: 40000,
      sitio: proveedor('bro', 'Bulonera Rosario', 'Bulonera Rosario', 'Rosario, Santa Fe', 1, 9, { bulon: { cap: 4000, normal: 0 } }),
    },
    {
      id: 'f-monitor',
      tipo: 'fuente',
      nombre: 'Homologar un segundo proveedor de monitores',
      costoAnual: 120000,
      sitio: proveedor('eco', 'Electrónica Córdoba', 'Electr. Córdoba', 'Córdoba', 1, 6, { monitor: { cap: 10, normal: 0 } }),
    },
    {
      id: 'f-caja',
      tipo: 'fuente',
      nombre: 'Homologar cajas de un proveedor brasileño',
      costoAnual: 90000,
      sitio: proveedor('rbr', 'Redutores Brasil', 'Redutores Brasil', 'Joinville, Brasil', 1, 9, { caja: { cap: 20, normal: 0 } }),
    },
    {
      id: 'f-chasis',
      tipo: 'fuente',
      nombre: 'Sumar una tercera metalúrgica para chasis',
      costoAnual: 200000,
      sitio: proveedor('mvm', 'Metalúrgica Villa María', 'Met. Villa María', 'Villa María, Córdoba', 1, 3, { chasis: { cap: 12, normal: 0 } }),
    },
  ],
};

/** Opciones del análisis. */
export const OPCIONES: Opciones = {
  // Presupuestos anuales que se exploran (US$).
  presupuestos: [0, 10000, 25000, 50000, 100000, 150000, 200000, 300000],
  // Planear con el TTR informado o con un 50% de margen.
  factores: [1, 1.5],
  factorLento: 1.5,
  // El plan "intuitivo": reforzar al proveedor al que más se le compra.
  intuitivo: { stock: {}, fuentes: ['f-chasis'] },
  semanasCurva: 20,
};

/** Presupuesto que se usa como ejemplo en la recomendación (US$ por año). */
export const PRESUPUESTO_RECOMENDADO = 200000;
