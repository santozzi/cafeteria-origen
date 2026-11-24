/**
 * Tipos compartidos de la Cafetería Origen.
 *
 * Describen las filas de la base de datos (docker/initdb/01-esquema.sql) y
 * los datos que viajan entre las rutas, los servicios y los middlewares.
 *
 * OJO: los tipos de TypeScript existen sólo en tiempo de compilación. Lo que
 * llega en `req.body`, `req.query` o `req.params` viene del cliente y en
 * ejecución puede tener CUALQUIER forma, diga lo que diga el tipo. Declarar
 * que `cantidad` es `number` no impide que llegue un texto o un negativo:
 * eso se comprueba con código en el servidor, no con anotaciones.
 */

/** PostgreSQL devuelve las columnas NUMERIC como texto ("2500.00"). */
export type Numerico = number | string;

export type Rol = 'admin' | 'barista' | 'mozo' | 'cliente';

export type TipoProducto = 'espresso' | 'filtrado' | 'pasteleria';

export type Variedad = 'Brasil' | 'Colombia' | 'Etiopía';

/** Datos de un producto, sin las columnas que genera la base. */
export interface DatosProducto {
  nombre: string;
  tipo: TipoProducto;
  variedad: Variedad | null;
  tamano: string | null;
  gramos: number | null;
  precio_base: Numerico;
  precio_por_gramo: Numerico;
  descripcion: string;
}

/** Fila de la tabla `productos`. */
export interface Producto extends DatosProducto {
  id: number;
  activo: boolean;
}

/** Producto con el precio final ya calculado. */
export interface ProductoConPrecio extends Producto {
  precio: number;
}

/** Fila de la tabla `usuarios`. */
export interface Usuario {
  id: number;
  username: string;
  password: string;
  rol: Rol;
  nombre: string | null;
  creado_en: Date;
}

/** Lo que se guarda del usuario dentro de la sesión. */
export type UsuarioSesion = Pick<Usuario, 'id' | 'username' | 'rol' | 'nombre'>;

export interface Sesion {
  usuario: UsuarioSesion;
  creadaEn: number;
  expiraEn: number;
  csrfToken: string;
}

/** Fila de la tabla `pedidos`. */
export interface Pedido {
  id: number;
  mesa: string | null;
  cliente: string | null;
  estado: string;
  total: Numerico;
  creado_en: Date;
}

/** Fila de `pedido_items` con el nombre del producto. */
export interface PedidoItem {
  id: number;
  pedido_id: number;
  producto_id: number;
  cantidad: number;
  precio_unitario: Numerico;
  producto_nombre: string;
}

export interface PedidoConItems extends Pedido {
  items: PedidoItem[];
}

/** Fila de la tabla `comentarios`. */
export interface Comentario {
  id: number;
  autor: string | null;
  texto: string | null;
  calificacion: number | null;
  creado_en: Date;
}

/** Error con código de estado HTTP opcional. */
export interface ErrorHttp extends Error {
  status?: number;
}

/**
 * `requiereSesion` deja el usuario y la sesión colgados de la petición.
 * Esto le avisa a TypeScript que `req.usuario` y `req.sesion` existen.
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuario?: UsuarioSesion;
      sesion?: Sesion;
    }
  }
}
