import type { VarianteAsignacion } from './template';

/**
 * Versión "Data center": trabajos nocturnos (batch) a servidores. Cada trabajo necesita que
 * su memoria entre en el servidor, y los trabajos de un servidor corren uno detrás de otro
 * dentro de la ventana nocturna.
 */
export const datacenter: VarianteAsignacion = {
  id: 'asignacion-datacenter',
  variant: 'Data center',
  title: 'Turno noche en el data center',
  client: 'Data center',
  estilo: 'rack',
  items: [
    { id: 'ml', label: 'Entrenamiento ML', size: 200, hours: 5 },
    { id: 'bi', label: 'Reportes BI', size: 120, hours: 3 },
    { id: 'etl', label: 'ETL ventas', size: 100, hours: 4 },
    { id: 'idx', label: 'Indexado', size: 60, hours: 3 },
    { id: 'bak', label: 'Backups', size: 48, hours: 4 },
    { id: 'log', label: 'Logs', size: 32, hours: 2 },
  ],
  bins: [
    { id: 's256', label: 'Servidor 256', size: 256, hours: 10 },
    { id: 's128', label: 'Servidor 128', size: 128, hours: 10 },
    { id: 's64', label: 'Servidor 64', size: 64, hours: 8 },
  ],
  vocab: {
    item: { singular: 'trabajo', plural: 'trabajos', el: 'el trabajo', los: 'los trabajos', set: 'T', index: 't' },
    bin: { singular: 'servidor', plural: 'servidores', al: 'al servidor', unoSolo: 'un solo servidor', set: 'S', index: 's' },
    size: {
      item: 'memoria (GB)',
      bin: 'memoria (GB)',
      Check: 'Memoria',
      regla: 'Un trabajo sólo puede correr en un servidor con **memoria suficiente**: si no entra en la RAM, se cae.',
      valor: (n) => `hasta ${n} GB`,
      falla: (b) => `Un trabajo de ${b} se queda sin memoria y se cae a mitad de la noche.`,
    },
    hours: {
      unit: 'h',
      periodo: 'por noche',
      falla: (b) => `Los trabajos de ${b} no terminan antes de que arranque el día.`,
    },
    desperdicio: {
      label: 'RAM ociosa (GB × hora)',
      param: 'RAM ociosa (GB libres × horas)',
      nota: 'Objetivo: minimizar la **RAM ociosa**. Mientras un trabajo corre, la memoria que no usa queda reservada sin hacer nada, y eso se paga. Se mide como GB libres × horas: los Logs (32 GB, 2 h) en el Servidor 256 desperdician $224 \\times 2 = 448$ GB·h.',
    },
    espera: 'En cola',
  },
  historia: [
    {
      type: 'p',
      text: 'Cada noche, el data center de **Nube Pampa** corre seis trabajos pesados. Cada trabajo tiene que ir a **un solo servidor**, y en cada servidor los trabajos corren uno detrás de otro dentro de la ventana nocturna, antes de que vuelvan los usuarios.',
    },
  ],
};
