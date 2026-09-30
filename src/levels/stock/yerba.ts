import type { VarianteStock } from './template';

/** Versión "Yerba": una yerbatera misionera decide en qué etapas guardar stock de seguridad. */
export const yerba: VarianteStock = {
  id: 'stock-yerba',
  variant: 'Yerba mate',
  title: '¿Dónde guardo el stock?',
  client: 'Yerbatera Tres Fronteras',
  cadena: {
    etapas: [
      { id: 'sec', nombre: 'Secanza y secado', corto: 'Secadero', lugar: 'Apóstoles', T: 3, valor: 0.3 },
      { id: 'est', nombre: 'Estacionamiento', corto: 'Estacionamiento', lugar: 'Apóstoles', T: 30, valor: 0.45 },
      { id: 'mol', nombre: 'Molienda y mezcla', corto: 'Molino', lugar: 'Posadas', T: 4, valor: 0.75 },
      { id: 'env', nombre: 'Envasado', corto: 'Envasadora', lugar: 'Posadas', T: 2, valor: 1.2 },
      { id: 'cd', nombre: 'Flete y centro de distribución', corto: 'CD Buenos Aires', lugar: 'Barracas', T: 6, valor: 1.6 },
    ],
    entrada: 2,
    servicio: 1,
    sigma: 6000,
    nivel: 0.95,
    z: 1.65,
    tasa: 0.3,
    unidad: 'kg',
  },
  historia: [
    {
      type: 'p',
      text: 'La **Yerbatera Tres Fronteras** vende yerba mate en todo el país. La hoja verde llega de los productores de Misiones y pasa por cinco etapas hasta la góndola: se seca, se **estaciona un mes**, se muele y mezcla, se envasa y viaja en camión al centro de distribución de Buenos Aires.',
    },
    {
      type: 'p',
      text: 'La demanda de los supermercados cambia todos los días y la yerbatera les promete entregar **al día siguiente**. Para no fallar hace falta **stock de seguridad**. La pregunta es **dónde**: la yerba canchada a granel es barata pero está lejos de la góndola; el paquete en Buenos Aires está listo para salir, pero vale más del triple.',
    },
  ],
};
