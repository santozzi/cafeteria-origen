/* =============================================================================
   Cafetería Origen — lógica del panel de administración
   ============================================================================= */
(function () {
  'use strict';

  var API = '/api';
  var usuario = null;
  var productosCache = {};
  var tokenCsrfCache = null;

  function $(sel) { return document.querySelector(sel); }
  function $$(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); }

  function money(valor) {
    return Number(valor || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
  }

  function crear(tag, clase, texto) {
    var el = document.createElement(tag);
    if (clase) el.className = clase;
    if (texto !== undefined && texto !== null) el.textContent = String(texto);
    return el;
  }

  function limpiar(el) {
    el.textContent = '';
  }

  function crearFila(celdas) {
    var fila = document.createElement('tr');
    celdas.forEach(function (celda) { fila.appendChild(celda); });
    return fila;
  }

  function renderTabla(destino, columnas, filas, mensajeVacio) {
    var thead = document.createElement('thead');
    var filaTitulos = document.createElement('tr');
    columnas.forEach(function (columna) {
      filaTitulos.appendChild(crear('th', columna.clase || null, columna.texto));
    });
    thead.appendChild(filaTitulos);

    var tbody = document.createElement('tbody');
    if (!filas || filas.length === 0) {
      var filaVacia = document.createElement('tr');
      var celdaVacia = crear('td', 'empty', mensajeVacio || 'No hay datos.');
      celdaVacia.colSpan = Math.max(1, columnas.length);
      filaVacia.appendChild(celdaVacia);
      tbody.appendChild(filaVacia);
    } else {
      filas.forEach(function (fila) { tbody.appendChild(fila); });
    }

    destino.replaceChildren(thead, tbody);
  }

  function renderKpis(destino, kpis) {
    limpiar(destino);
    kpis.forEach(function (kpi) {
      var caja = crear('div', 'kpi');
      caja.appendChild(crear('div', 'kpi-label', kpi.label));
      caja.appendChild(crear('div', 'kpi-value', kpi.value));
      destino.appendChild(caja);
    });
  }

  function obtenerTokenCsrf() {
    if (tokenCsrfCache) return Promise.resolve(tokenCsrfCache);
    return fetch(API + '/csrf-token', { credentials: 'same-origin' })
      .then(function (res) { return res.ok ? res.json() : {}; })
      .then(function (data) {
        tokenCsrfCache = data.token || '';
        return tokenCsrfCache;
      })
      .catch(function () { return ''; });
  }

  function api(url, opciones) {
    var opt = opciones ? Object.assign({}, opciones) : {};
    var metodo = (opt.method || 'GET').toUpperCase();
    var preparar = metodo === 'GET' || metodo === 'HEAD'
      ? Promise.resolve('')
      : obtenerTokenCsrf();

    return preparar.then(function (token) {
      if (token) {
        opt.headers = Object.assign({}, opt.headers || {}, { 'X-CSRF-Token': token });
      }
      return fetch(API + url, opt);
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        return { ok: res.ok, status: res.status, data: data };
      });
    });
  }

  function postJSON(url, cuerpo) {
    return api(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo || {}),
    });
  }

  function putJSON(url, cuerpo) {
    return api(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo || {}),
    });
  }

  function patchJSON(url, cuerpo) {
    return api(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo || {}),
    });
  }

  function feedback(el, mensaje, ok) {
    el.className = 'form-feedback ' + (ok ? 'is-ok' : 'is-error');
    el.textContent = mensaje;
  }

  /* ------------------------------------------------------------------ login */
  function iniciarSesion(evento) {
    evento.preventDefault();
    var caja = $('#login-feedback');
    caja.className = 'form-feedback';

    postJSON('/auth/login', {
      username: $('#login-usuario').value,
      password: $('#login-password').value,
    }).then(function (resp) {
      if (!resp.ok) {
        feedback(caja, 'No pudimos iniciar sesión: ' + (resp.data.error || 'error desconocido'), false);
        return;
      }
      usuario = resp.data.usuario;
      mostrarPanel();
    });
  }

  function cerrarSesion() {
    postJSON('/auth/logout', {}).then(function () {
      usuario = null;
      $('#vista-login').hidden = false;
      $('#vista-panel').hidden = true;
      $('#admin-user').textContent = '';
    });
  }

  function mostrarPanel() {
    $('#vista-login').hidden = true;
    $('#vista-panel').hidden = false;

    var info = $('#admin-user');
    limpiar(info);
    info.appendChild(document.createTextNode('Sesión de '));
    info.appendChild(crear('strong', null, usuario.nombre));
    info.appendChild(document.createTextNode(' · rol: '));
    info.appendChild(crear('strong', null, usuario.rol));

    $('#panel-bienvenida').textContent = 'Hola, ' + usuario.nombre;
    cargarTodo();
  }

  function cargarTodo() {
    cargarResumen();
    cargarPedidos();
    cargarProductos();
    cargarReportes();
    cargarUsuarios();
  }

  /* ---------------------------------------------------------------- resumen */
  function cargarResumen() {
    api('/reportes/facturacion').then(function (f) {
      api('/reportes/mas-vendido').then(function (m) {
        api('/reportes/cantidad-vendida').then(function (c) {
          var mas = m.data.producto;
          var kpis = [
            { label: 'Facturación total', value: money(f.data.facturado) },
            { label: 'Pedidos registrados', value: f.data.pedidos },
            {
              label: 'Producto más vendido',
              value: mas ? mas.nombre : '—',
            },
            {
              label: 'Unidades por tipo',
              value: Object.keys(c.data.cantidadVendida || {})
                .map(function (k) { return k + ': ' + c.data.cantidadVendida[k]; })
                .join(' · ') || '—',
            },
          ];

          renderKpis($('#kpis'), kpis);
        });
      });
    });
  }

  /* --------------------------------------------------------------- pedidos */
  function columnasPedidos(conAcciones) {
    var columnas = [
      { texto: '#' },
      { texto: 'Mesa' },
      { texto: 'Cliente' },
      { texto: 'Estado' },
      { texto: 'Total', clase: 'num' },
      { texto: 'Fecha' },
    ];
    if (conAcciones) columnas.push({ texto: 'Acciones' });
    return columnas;
  }

  function filasPedidos(pedidos, conAcciones) {
    return pedidos.map(function (p) {
      var tdEstado = crear('td');
      tdEstado.appendChild(crear('span', 'badge badge-' + p.estado, p.estado));

      var celdas = [
        crear('td', null, p.id),
        crear('td', null, p.mesa),
        crear('td', null, p.cliente),
        tdEstado,
        crear('td', 'num', money(p.total)),
        crear('td', null, new Date(p.creado_en).toLocaleString('es-AR')),
      ];

      if (conAcciones) {
        var tdAcciones = crear('td');
        var select = document.createElement('select');
        select.className = 'sel-estado';
        select.setAttribute('data-pedido', p.id);
        ['abierto', 'preparando', 'listo', 'entregado'].forEach(function (estado) {
          var opcion = document.createElement('option');
          opcion.value = estado;
          opcion.textContent = estado;
          opcion.selected = estado === p.estado;
          select.appendChild(opcion);
        });
        tdAcciones.appendChild(select);
        celdas.push(tdAcciones);
      }

      return crearFila(celdas);
    });
  }

  function cargarPedidos() {
    api('/pedidos').then(function (resp) {
      var pedidos = resp.data.pedidos || [];
      renderTabla($('#tabla-pedidos'), columnasPedidos(true), filasPedidos(pedidos, true), 'No hay pedidos.');
      renderTabla($('#tabla-ultimos'), columnasPedidos(false), filasPedidos(pedidos.slice(0, 5), false), 'No hay pedidos.');
    });
  }

  function cambiarEstado(evento) {
    var select = evento.target.closest('.sel-estado');
    if (!select) return;
    var id = select.getAttribute('data-pedido');
    patchJSON('/pedidos/' + id + '/estado', { estado: select.value }).then(function (resp) {
      if (!resp.ok) {
        alert('No se pudo cambiar el estado: ' + (resp.data.error || 'error'));
      }
      cargarPedidos();
    });
  }

  /* ------------------------------------------------------------- productos */
  function cargarProductos() {
    api('/productos').then(function (resp) {
      var productos = resp.data.productos || [];
      productosCache = {};

      var filas = productos.map(function (p) {
        productosCache[p.id] = p;

        var tdAcciones = crear('td');
        var boton = crear('button', 'link-danger', 'Borrar');
        boton.type = 'button';
        boton.setAttribute('data-borrar', p.id);
        tdAcciones.appendChild(boton);

        return crearFila([
          crear('td', null, p.id),
          crear('td', null, p.nombre),
          crear('td', null, p.tipo),
          crear('td', null, p.variedad || '—'),
          crear('td', 'num', money(p.precio)),
          tdAcciones,
        ]);
      });

      renderTabla(
        $('#tabla-productos'),
        [
          { texto: '#' },
          { texto: 'Nombre' },
          { texto: 'Tipo' },
          { texto: 'Origen' },
          { texto: 'Precio', clase: 'num' },
          { texto: 'Acciones' },
        ],
        filas,
        'No hay productos.'
      );
    });
  }

  function guardarProducto(evento) {
    evento.preventDefault();
    var caja = $('#producto-feedback');
    var id = $('#producto-id').value;

    var cuerpo = {
      nombre: $('#p-nombre').value,
      tipo: $('#p-tipo').value,
      variedad: $('#p-variedad').value || null,
      tamano: $('#p-tamano').value || null,
      gramos: $('#p-gramos').value ? Number($('#p-gramos').value) : null,
      precio_base: Number($('#p-precio-base').value || 0),
      precio_por_gramo: Number($('#p-precio-gramo').value || 0),
      descripcion: $('#p-descripcion').value,
    };

    var peticion = id ? putJSON('/admin/productos/' + id, cuerpo) : postJSON('/admin/productos', cuerpo);

    peticion.then(function (resp) {
      if (!resp.ok) {
        feedback(caja, 'No se pudo guardar: ' + (resp.data.error || 'error desconocido'), false);
        return;
      }
      feedback(caja, 'Producto guardado correctamente.', true);
      $('#form-producto').reset();
      $('#producto-id').value = '';
      cargarProductos();
    });
  }

  function borrarProducto(evento) {
    var btn = evento.target.closest('[data-borrar]');
    if (!btn) return;
    var id = btn.getAttribute('data-borrar');
    if (!confirm('¿Borrar el producto #' + id + '?')) return;

    api('/admin/productos/' + id, { method: 'DELETE' }).then(function (resp) {
      if (!resp.ok) alert('No se pudo borrar: ' + (resp.data.error || 'error'));
      cargarProductos();
    });
  }

  function limpiarFormularioProducto() {
    $('#form-producto').reset();
    $('#producto-id').value = '';
  }

  /* ---------------------------------------------------------------- upload */
  function subirArchivo(evento) {
    evento.preventDefault();
    var caja = $('#upload-feedback');
    var input = $('#archivo-subida');
    if (!input.files || !input.files[0]) {
      feedback(caja, 'Elegí un archivo primero.', false);
      return;
    }

    var archivo = input.files[0];
    var lector = new FileReader();

    lector.onload = function () {
      var base64 = String(lector.result).split(',')[1] || '';
      postJSON('/admin/subir-archivo', {
        nombre: archivo.name,
        contenidoBase64: base64,
      }).then(function (resp) {
        if (!resp.ok) {
          feedback(caja, 'No se pudo subir: ' + (resp.data.error || 'error desconocido'), false);
          return;
        }
        feedback(caja, 'Archivo subido a ' + resp.data.url, true);
      });
    };

    lector.readAsDataURL(archivo);
  }

  /* -------------------------------------------------------------- reportes */
  function cargarReportes() {
    api('/reportes/facturacion').then(function (f) {
      api('/reportes/ticket-promedio').then(function (t) {
        api('/reportes/mas-vendido').then(function (m) {
          var mas = m.data.producto;
          var kpis = [
            { label: 'Facturación', value: money(f.data.facturado) },
            { label: 'Pedidos', value: f.data.pedidos },
            { label: 'Ticket promedio', value: money(t.data.promedio) },
            { label: 'Más vendido', value: mas ? mas.nombre + ' (' + mas.unidades + ')' : '—' },
          ];
          renderKpis($('#kpis-reportes'), kpis);
        });
      });
    });
  }

  function consultarVentas() {
    var caja = $('#reporte-feedback');
    var variedad = $('#reporte-variedad').value;

    api('/reportes/ventas-por-variedad?variedad=' + encodeURIComponent(variedad)).then(function (resp) {
      if (!resp.ok) {
        feedback(caja, 'Error: ' + (resp.data.error || 'desconocido'), false);
        limpiar($('#tabla-ventas'));
        return;
      }

      var ventas = resp.data.ventas || [];
      var filas = ventas.map(function (v) {
        return crearFila([
          crear('td', null, v.variedad),
          crear('td', null, v.nombre),
          crear('td', 'num', v.unidades),
          crear('td', 'num', money(v.total)),
        ]);
      });

      renderTabla(
        $('#tabla-ventas'),
        [
          { texto: 'Origen' },
          { texto: 'Producto' },
          { texto: 'Unidades', clase: 'num' },
          { texto: 'Total', clase: 'num' },
        ],
        filas,
        'No hay ventas para ese origen.'
      );
      feedback(caja, 'Consulta realizada.', true);
    });
  }

  /* -------------------------------------------------------------- usuarios */
  function cargarUsuarios() {
    api('/admin/usuarios').then(function (resp) {
      var usuarios = resp.data.usuarios || [];

      var filas = usuarios.map(function (u) {
        var tdRol = crear('td');
        tdRol.appendChild(crear('span', 'badge' + (u.rol === 'admin' ? ' badge-admin' : ''), u.rol));

        var tdSelect = crear('td');
        var select = document.createElement('select');
        select.className = 'sel-rol';
        select.setAttribute('data-usuario', u.id);
        ['cliente', 'mozo', 'barista', 'admin'].forEach(function (rol) {
          var opcion = document.createElement('option');
          opcion.value = rol;
          opcion.textContent = rol;
          opcion.selected = rol === u.rol;
          select.appendChild(opcion);
        });
        tdSelect.appendChild(select);

        return crearFila([
          crear('td', null, u.id),
          crear('td', null, u.username),
          crear('td', null, u.nombre),
          tdRol,
          tdSelect,
        ]);
      });

      renderTabla(
        $('#tabla-usuarios'),
        [
          { texto: '#' },
          { texto: 'Usuario' },
          { texto: 'Nombre' },
          { texto: 'Rol' },
          { texto: 'Acciones' },
        ],
        filas,
        'No hay usuarios.'
      );
    });
  }

  function cambiarRol(evento) {
    var select = evento.target.closest('.sel-rol');
    if (!select) return;
    var id = select.getAttribute('data-usuario');

    putJSON('/admin/usuarios/' + id, { rol: select.value }).then(function (resp) {
      if (!resp.ok) alert('No se pudo actualizar: ' + (resp.data.error || 'error'));
      cargarUsuarios();
    });
  }

  function cambiarPassword(evento) {
    evento.preventDefault();
    var caja = $('#password-feedback');
    postJSON('/admin/cambiar-contrasena', { nueva: $('#nueva-password').value }).then(function (resp) {
      if (!resp.ok) {
        feedback(caja, 'No se pudo cambiar: ' + (resp.data.error || 'error desconocido'), false);
        return;
      }
      feedback(caja, 'Contraseña actualizada.', true);
      $('#nueva-password').value = '';
    });
  }

  /* ----------------------------------------------------------- herramientas */
  function probarConexion(evento) {
    evento.preventDefault();
    var salida = $('#salida-conexion');
    salida.textContent = 'Probando…';

    postJSON('/admin/probar-conexion', { host: $('#conexion-host').value }).then(function (resp) {
      if (!resp.ok) {
        salida.textContent = 'Error: ' + (resp.data.error || 'desconocido');
        return;
      }
      salida.textContent =
        '$ ' + resp.data.comando + '\n\n' +
        (resp.data.salida || '') +
        (resp.data.error ? '\n[stderr]\n' + resp.data.error : '');
    });
  }

  function verDiagnostico() {
    var salida = $('#salida-diagnostico');
    salida.textContent = 'Cargando…';
    api('/_diagnostico').then(function (resp) {
      salida.textContent = JSON.stringify(resp.data, null, 2);
    });
  }

  /* ------------------------------------------------------------------ tabs */
  function activarTab(evento) {
    var tab = evento.target.closest('.tab');
    if (!tab) return;
    var vista = tab.getAttribute('data-vista');
    $$('.tab').forEach(function (t) { t.classList.remove('is-active'); });
    tab.classList.add('is-active');
    $$('.tab-panel').forEach(function (p) {
      p.classList.toggle('is-active', p.getAttribute('data-panel') === vista);
    });
  }

  /* ------------------------------------------------------------------ init */
  function init() {
    var vistas = ['resumen', 'pedidos', 'productos', 'reportes', 'usuarios', 'herramientas'];
    var objetivo = new URLSearchParams(window.location.search).get('vista');
    if (objetivo && vistas.indexOf(objetivo) !== -1) {
      $('#panel-bienvenida').textContent = 'Panel ' + objetivo;
    }

    $('#form-login').addEventListener('submit', iniciarSesion);
    $('#btn-logout').addEventListener('click', cerrarSesion);
    $('#btn-refrescar').addEventListener('click', cargarTodo);
    $('#tabs').addEventListener('click', activarTab);
    $('#tabla-pedidos').addEventListener('change', cambiarEstado);
    $('#tabla-productos').addEventListener('click', borrarProducto);
    $('#form-producto').addEventListener('submit', guardarProducto);
    $('#btn-limpiar-producto').addEventListener('click', limpiarFormularioProducto);
    $('#form-upload').addEventListener('submit', subirArchivo);
    $('#form-password').addEventListener('submit', cambiarPassword);
    $('#btn-reporte-variedad').addEventListener('click', consultarVentas);
    $('#tabla-usuarios').addEventListener('change', cambiarRol);
    $('#form-conexion').addEventListener('submit', probarConexion);
    $('#btn-diagnostico').addEventListener('click', verDiagnostico);

    // ¿Ya hay sesión?
    api('/auth/yo').then(function (resp) {
      if (resp.ok) {
        usuario = resp.data.usuario;
        mostrarPanel();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
