/* =============================================================================
   Cafetería Origen — lógica del sitio público
   ============================================================================= */
(function () {
  'use strict';

  var API = '/api';
  var CARRITO_KEY = 'origen.carrito';
  var tokenCsrfCache = null;

  var estado = {
    tipo: '',
    variedad: '',
    q: '',
    carrito: cargarCarrito(),
  };

  /* ---------------------------------------------------------------- utils */
  function $(sel) { return document.querySelector(sel); }

  function money(valor) {
    var n = Number(valor || 0);
    return n.toLocaleString('es-AR', { style: 'currency', currency: 'ARS' });
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

  function guardarCarrito() {
    try {
      localStorage.setItem(CARRITO_KEY, JSON.stringify(estado.carrito));
    } catch (e) { /* almacenamiento no disponible */ }
  }

  function cargarCarrito() {
    try {
      return JSON.parse(localStorage.getItem(CARRITO_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  /* ------------------------------------------------------------- catálogo */
  function urlCatalogo() {
    var params = new URLSearchParams();
    if (estado.tipo) params.set('tipo', estado.tipo);
    if (estado.variedad) params.set('variedad', estado.variedad);
    if (estado.q) params.set('q', estado.q);
    var s = params.toString();
    return '/productos' + (s ? '?' + s : '');
  }

  function cargarProductos() {
    return api(urlCatalogo()).then(function (resp) {
      if (!resp.ok) {
        renderErrorProductos(resp.data && resp.data.error);
        return;
      }
      renderProductos(resp.data.productos);
      renderResultado(resp.data.filtros, resp.data.total);
    });
  }

  function renderProductos(productos) {
    var grid = $('#productos-grid');
    limpiar(grid);

    if (!productos || productos.length === 0) {
      grid.appendChild(crear('p', 'empty', 'No encontramos productos con esos filtros.'));
      return;
    }

    productos.forEach(function (p) {
      window.__productos[p.id] = p;

      var card = crear('article', 'product-card');

      var top = crear('div', 'product-top');
      top.appendChild(crear('h3', 'product-name', p.nombre));
      top.appendChild(crear('span', 'product-price', money(p.precio)));
      card.appendChild(top);

      var tags = crear('div', 'product-tags');
      tags.appendChild(crear('span', 'tag', p.tipo));
      if (p.variedad) tags.appendChild(crear('span', 'tag tag-origen', p.variedad));
      if (p.tamano) tags.appendChild(crear('span', 'tag', p.tamano));
      card.appendChild(tags);

      card.appendChild(crear('p', 'product-desc', p.descripcion));

      var boton = crear('button', 'btn btn-ghost btn-agregar', 'Agregar');
      boton.type = 'button';
      boton.setAttribute('data-id', p.id);
      card.appendChild(boton);

      grid.appendChild(card);
    });
  }

  function renderResultado(filtros, total) {
    var el = $('#resultado-busqueda');
    limpiar(el);

    if (filtros && filtros.q) {
      el.appendChild(document.createTextNode('Resultados para '));
      el.appendChild(crear('strong', null, filtros.q));
      el.appendChild(document.createTextNode(' — ' + total + ' producto(s)'));
    } else {
      el.textContent = total + ' producto(s) en el menú';
    }
  }

  function renderErrorProductos(mensaje) {
    var grid = $('#productos-grid');
    limpiar(grid);
    grid.appendChild(crear('p', 'empty', 'No se pudo cargar el menú: ' + (mensaje || 'error desconocido')));
  }

  /* --------------------------------------------------------------- carrito */
  function agregarAlCarrito(productoId) {
    var existente = null;
    for (var i = 0; i < estado.carrito.length; i++) {
      if (String(estado.carrito[i].id) === String(productoId)) existente = estado.carrito[i];
    }
    if (existente) {
      existente.cantidad += 1;
    } else {
      estado.carrito.push({
        id: productoId,
        nombre: window.__productos[productoId] ? window.__productos[productoId].nombre : 'Producto',
        precio: window.__productos[productoId] ? window.__productos[productoId].precio : 0,
        cantidad: 1,
      });
    }
    guardarCarrito();
    renderCarrito();
  }

  function cambiarCantidad(indice, delta) {
    var item = estado.carrito[indice];
    if (!item) return;
    item.cantidad += delta;
    if (item.cantidad <= 0) estado.carrito.splice(indice, 1);
    guardarCarrito();
    renderCarrito();
  }

  function quitarDelCarrito(indice) {
    estado.carrito.splice(indice, 1);
    guardarCarrito();
    renderCarrito();
  }

  function renderCarrito() {
    var cont = $('#carrito');
    var lista = $('#resumen-carrito');
    var total = 0;

    limpiar(cont);
    limpiar(lista);

    if (estado.carrito.length === 0) {
      cont.appendChild(crear('p', 'empty', 'El carrito está vacío.'));
      $('#resumen-total').textContent = money(0);
      return;
    }

    estado.carrito.forEach(function (item, i) {
      var subtotal = item.precio * item.cantidad;
      total += subtotal;

      var fila = crear('div', 'cart-item');

      var info = crear('div');
      info.appendChild(crear('div', 'cart-item-name', item.nombre));
      info.appendChild(crear('div', 'cart-item-meta', money(item.precio) + ' c/u'));
      fila.appendChild(info);

      var cantidad = crear('div', 'qty-control');
      var menos = crear('button', null, '−');
      menos.type = 'button';
      menos.setAttribute('data-acc', 'menos');
      menos.setAttribute('data-i', i);
      cantidad.appendChild(menos);
      cantidad.appendChild(crear('span', null, item.cantidad));
      var mas = crear('button', null, '+');
      mas.type = 'button';
      mas.setAttribute('data-acc', 'mas');
      mas.setAttribute('data-i', i);
      cantidad.appendChild(mas);
      fila.appendChild(cantidad);

      var acciones = crear('div');
      acciones.appendChild(crear('div', 'cart-item-price', money(subtotal)));
      var quitar = crear('button', 'link-danger', 'Quitar');
      quitar.type = 'button';
      quitar.setAttribute('data-acc', 'quitar');
      quitar.setAttribute('data-i', i);
      acciones.appendChild(quitar);
      fila.appendChild(acciones);

      cont.appendChild(fila);

      var itemResumen = crear('li');
      itemResumen.appendChild(crear('span', null, item.nombre + ' × ' + item.cantidad));
      itemResumen.appendChild(crear('span', null, money(item.precio * item.cantidad)));
      lista.appendChild(itemResumen);
    });

    $('#resumen-total').textContent = money(total);
  }

  /* ---------------------------------------------------------------- pedidos */
  function enviarPedido(evento) {
    evento.preventDefault();
    var feedback = $('#pedido-feedback');
    feedback.className = 'form-feedback';
    feedback.textContent = 'Enviando…';

    postJSON('/pedidos', {
      mesa: $('#pedido-mesa').value,
      cliente: $('#pedido-cliente').value,
      items: estado.carrito.map(function (item) {
        return { productoId: item.id, cantidad: item.cantidad };
      }),
    }).then(function (resp) {
      if (!resp.ok) {
        feedback.className = 'form-feedback is-error';
        feedback.textContent = 'No pudimos enviar el pedido: ' + (resp.data.error || 'error desconocido');
        return;
      }
      feedback.className = 'form-feedback is-ok';
      feedback.textContent = '¡Pedido #' + resp.data.id + ' recibido! Total ' + money(resp.data.total) +
        '. Te atendemos en la mesa ' + resp.data.mesa + '.';
      estado.carrito = [];
      guardarCarrito();
      renderCarrito();
      $('#form-pedido').reset();
    }).catch(function () {
      feedback.className = 'form-feedback is-error';
      feedback.textContent = 'Error de conexión con el servidor.';
    });
  }

  /* --------------------------------------------------------------- reseñas */
  function cargarReseñas() {
    return api('/comentarios').then(function (resp) {
      var cont = $('#lista-resenas');
      limpiar(cont);

      if (!resp.ok || !resp.data.comentarios || resp.data.comentarios.length === 0) {
        cont.appendChild(crear('p', 'empty', 'Todavía no hay reseñas. ¡Sé el primero!'));
        return;
      }

      resp.data.comentarios.forEach(function (c) {
        var articulo = crear('article', 'review');

        var cabecera = crear('div', 'review-head');
        cabecera.appendChild(crear('span', 'review-author', c.autor));

        var estrellas = '';
        var cantidad = Math.floor(Math.max(0, Math.min(5, Number(c.calificacion) || 0)));
        for (var i = 0; i < cantidad; i++) estrellas += '★';
        cabecera.appendChild(crear('span', 'review-stars', estrellas));
        articulo.appendChild(cabecera);

        articulo.appendChild(crear('p', 'review-text', c.texto));
        cont.appendChild(articulo);
      });
    });
  }

  function enviarReseña(evento) {
    evento.preventDefault();
    var feedback = $('#resena-feedback');
    feedback.className = 'form-feedback';
    feedback.textContent = 'Publicando…';

    postJSON('/comentarios', {
      autor: $('#resena-autor').value,
      texto: $('#resena-texto').value,
      calificacion: Number($('#resena-calificacion').value),
    }).then(function (resp) {
      if (!resp.ok) {
        feedback.className = 'form-feedback is-error';
        feedback.textContent = 'No se pudo publicar: ' + (resp.data.error || 'error desconocido');
        return;
      }
      feedback.className = 'form-feedback is-ok';
      feedback.textContent = '¡Gracias por tu reseña!';
      $('#form-resena').reset();
      cargarReseñas();
    });
  }

  /* ------------------------------------------------------------- listeners */
  function init() {
    window.__productos = {};

    // Filtros
    document.querySelectorAll('.chip').forEach(function (chip) {
      chip.addEventListener('click', function () {
        document.querySelectorAll('.chip').forEach(function (c) { c.classList.remove('is-active'); });
        chip.classList.add('is-active');
        estado.tipo = chip.getAttribute('data-tipo');
        cargarProductos();
      });
    });

    $('#filtro-variedad').addEventListener('change', function (e) {
      estado.variedad = e.target.value;
      cargarProductos();
    });

    var temporizador = null;
    $('#filtro-busqueda').addEventListener('input', function (e) {
      estado.q = e.target.value;
      clearTimeout(temporizador);
      temporizador = setTimeout(cargarProductos, 250);
    });

    // Carrito (delegación de eventos)
    $('#productos-grid').addEventListener('click', function (e) {
      var btn = e.target.closest('.btn-agregar');
      if (!btn) return;
      agregarAlCarrito(btn.getAttribute('data-id'));
    });

    $('#carrito').addEventListener('click', function (e) {
      var btn = e.target.closest('button');
      if (!btn) return;
      var i = Number(btn.getAttribute('data-i'));
      var accion = btn.getAttribute('data-acc');
      if (accion === 'mas') cambiarCantidad(i, 1);
      else if (accion === 'menos') cambiarCantidad(i, -1);
      else if (accion === 'quitar') quitarDelCarrito(i);
    });

    $('#form-pedido').addEventListener('submit', enviarPedido);
    $('#form-resena').addEventListener('submit', enviarReseña);

    // Carga inicial
    cargarProductos();
    cargarReseñas();
    renderCarrito();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
