import type { Rol, TipoProducto, Variedad } from "./tipos";

/** error de validacion: el middleware de errores lo responde como 400 */

export class ErrorValidacion extends Error{
    readonly status=400;

    constructor(mensaje:string){
        super(mensaje);
        this.name ='ErrorValidacion';
    }
}

/* --------------------------- listas blancas --------------------------- */

export const ALLOWED_ROLES: readonly Rol[] = ['admin', 'barista', 'mozo', 'cliente'];

export const ALLOWED_TIPOS: readonly TipoProducto[] = [
  'espresso',
  'filtrado',
  'pasteleria',
];

export const ALLOWED_VARIEDADES: readonly Variedad[] = [
  'Brasil',
  'Colombia',
  'Etiopía',
];

export const ALLOWED_ESTADOS_PEDIDO = [
  'abierto',
  'preparando',
  'listo',
  'entregado',
] as const;

export type EstadoPedido = (typeof ALLOWED_ESTADOS_PEDIDO)[number];

/* ------------------------------ helpers ------------------------------- */

/** caracteres de control que no deberian viajar en un texto (salvo \n y \t). */
const CARACTERES_DE_CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

/** valida un texto: tipo string, longitud y ausencia de caracteres de control. */
export function texto(valor: unknown, campo: string, min: number, max: number): string {
  if (typeof valor !== 'string') {
    throw new ErrorValidacion(`${campo} debe ser texto.`);
  }
  const limpio = valor.trim();
  if (limpio.length < min || limpio.length > max) {
    throw new ErrorValidacion(`${campo} debe tener entre ${min} y ${max} caracteres.`);
  }
  if (CARACTERES_DE_CONTROL.test(limpio)) {
    throw new ErrorValidacion(`${campo} contiene caracteres no permitidos.`);
  }
  return limpio;
}

export function textoConFormato(
  valor: unknown,
  campo: string,
  min: number,
  max: number,
  formato: RegExp
): string {
  const limpio = texto(valor, campo, min, max);
  if (!formato.test(limpio)) {
    throw new ErrorValidacion(`${campo} tiene un formato invalido.`);
  }
  return limpio;
}

/** valida un entero (acepta strings numericos) dentro de un rango. */
export function entero(valor: unknown, campo: string, min: number, max: number): number {
  let numero: number;

  if (typeof valor === 'string') {
    if (!/^-?\d+$/.test(valor.trim())) {
      throw new ErrorValidacion(`${campo} debe ser un numero entero.`);
    }
    numero = Number(valor.trim());
  } else if (typeof valor === 'number') {
    numero = valor;
  } else {
    throw new ErrorValidacion(`${campo} debe ser un numero entero.`);
  }

  if (!Number.isInteger(numero)) {
    throw new ErrorValidacion(`${campo} debe ser un numero entero.`);
  }
  if (numero < min || numero > max) {
    throw new ErrorValidacion(`${campo} debe estar entre ${min} y ${max}.`);
  }
  return numero;
}

/** valida que el valor este dentro de una lista blanca. */
export function unoDe<T extends string>(
  valor: unknown,
  valoresValidos: readonly T[],
  campo: string
): T {
  if (typeof valor !== 'string' || !(valoresValidos as readonly string[]).includes(valor)) {
    throw new ErrorValidacion(`${campo} no es un valor permitido.`);
  }
  return valor as T;
}

/** Valida que sea un array y acota la cantidad de elementos. */
export function arreglo<T>(valor: unknown, campo: string, min: number, max: number): T[] {
  if (!Array.isArray(valor)) {
    throw new ErrorValidacion(`${campo} debe ser una lista.`);
  }
  if (valor.length < min || valor.length > max) {
    throw new ErrorValidacion(`${campo} debe tener entre ${min} y ${max} elementos.`);
  }
  return valor as T[];
}