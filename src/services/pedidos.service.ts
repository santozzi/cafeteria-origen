import * as db from '../db';
import { calcularPrecio } from '../catalogo';
import type { Pedido, PedidoConItems, PedidoItem, Producto } from '../tipos';
import {
  ALLOWED_ESTADOS_PEDIDO,
  ErrorValidacion,
  arreglo,
  entero,
  texto,
  textoConFormato,
  unoDe,
} from '../validacion';
/** Un renglón del pedido, tal como llega en el cuerpo de la petición. */
export interface ItemPedido {
  productoId: number;
  cantidad: number;
}

/** Pedido nuevo, tal como llega en el cuerpo de la petición. */
export interface NuevoPedido {
  mesa: string;
  cliente: string;
  items: ItemPedido[];
}

/** Id tal como llega en la URL (texto) o ya convertido. */
type Id = number | string;

/**
 * Servicio de pedidos.
 *
 * -----------------------------------------------------------------------------
 * FALLA — Validación de entrada débil o insuficiente (OWASP A04:2021)
 * -----------------------------------------------------------------------------
 * No se valida nada de lo que llega en el cuerpo de la petición:
 *  - `cantidad` puede ser negativa (el total del pedido queda negativo),
 *    cero, un número decimal o un texto.
 *  - No hay un máximo de items ni de cantidad (DoS / facturas absurdas).
 *  - `mesa` y `cliente` no se validan ni se acotan en longitud.
 *  - Si el productoId no existe, la excepción sube y se filtra el stack.
 *
 * La corrección es validar TIPO (entero), RANGO (1..N), LONGITUD y FORMATO
 * de cada campo en el servidor, usando listas blancas.
 * -----------------------------------------------------------------------------
 */

/**
 * Crea un pedido a partir de una lista de items { productoId, cantidad }.
 * Total = suma de calcularPrecio(producto) x cantidad
 */
export async function crear({ mesa, cliente, items }: NuevoPedido): Promise<PedidoConItems | null> {
  const mesaValida = textoConFormato(mesa, 'mesa', 1, 10, /^[A-Za-z0-9 _-]+$/);
  const clienteValido = texto(cliente, 'cliente', 2, 60);
  const itemsValidos = arreglo<unknown>(items, 'items', 1, 20);

  const filas: { productoId: number; cantidad: number; precioUnitario: number }[] = [];

  for (const item of itemsValidos) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new ErrorValidacion('Cada ítem del pedido debe ser un objeto.');
    }
    const { productoId, cantidad } = item as { productoId?: unknown; cantidad?: unknown };
    const productoIdValido = entero(productoId, 'productoId', 1, 2147483647);
    const cantidadValida = entero(cantidad, 'cantidad', 1, 99);

    const producto = await buscarProducto(productoIdValido);
    if (!producto) {
      throw new ErrorValidacion('El producto del pedido no existe.');
    }

    filas.push({
      productoId: producto.id,
      cantidad: cantidadValida,
      precioUnitario: calcularPrecio(producto),
    });
  }

  const total = filas.reduce((acc, f) => acc + f.precioUnitario * f.cantidad, 0);

  const { rows } = await db.query<Pedido>(
    `INSERT INTO pedidos (mesa, cliente, estado, total)
     VALUES ($1, $2, 'abierto', $3)
     RETURNING *`,
    [mesaValida, clienteValido, total]
  );
  const pedido = rows[0];

  for (const fila of filas) {
    await db.query(
      `INSERT INTO pedido_items (pedido_id, producto_id, cantidad, precio_unitario)
       VALUES ($1, $2, $3, $4)`,
      [pedido.id, fila.productoId, fila.cantidad, fila.precioUnitario]
    );
  }

  return obtenerConItems(pedido.id);
}

/** Busca un producto por id (helper interno). */
async function buscarProducto(productoId: number): Promise<Producto> {
  const { rows } = await db.query<Producto>('SELECT * FROM productos WHERE id = $1', [productoId]);
  return rows[0];
}

/** Lista pedidos (con filtro opcional por mesa). */
export async function listar(mesa?: string): Promise<Pedido[]> {
  const valores: unknown[] = [];
  let sql = 'SELECT * FROM pedidos';

  if (mesa !== undefined && mesa !== '') {
    const mesaValida = textoConFormato(mesa, 'mesa', 1, 10, /^[A-Za-z0-9 _-]+$/);
    valores.push(mesaValida);
    sql += ' WHERE mesa = $1';
  }

  sql += ' ORDER BY id DESC';

  const { rows } = await db.query<Pedido>(sql, valores);
  return rows;
}

/** Devuelve un pedido con sus items. */
export async function obtenerConItems(id: Id): Promise<PedidoConItems | null> {
  const { rows: pedidos } = await db.query<Pedido>(
    'SELECT * FROM pedidos WHERE id = $1',
    [id]
  );
  const pedido = pedidos[0];
  if (!pedido) return null;

  const { rows: items } = await db.query<PedidoItem>(
    `SELECT pi.*, pr.nombre AS producto_nombre
       FROM pedido_items pi
       JOIN productos pr ON pr.id = pi.producto_id
      WHERE pi.pedido_id = $1`,
    [id]
  );

  return { ...pedido, items };
}

/** Cambia el estado de un pedido. */
export async function cambiarEstado(id: Id, estado: string): Promise<Pedido | null> {
  const idValido = entero(id, 'id', 1, 2147483647);
  const estadoValido = unoDe(estado, ALLOWED_ESTADOS_PEDIDO, 'estado');

  const { rows } = await db.query<Pedido>(
    'UPDATE pedidos SET estado = $1 WHERE id = $2 RETURNING *',
    [estadoValido, idValido]
  );
  return rows[0] || null;
}
