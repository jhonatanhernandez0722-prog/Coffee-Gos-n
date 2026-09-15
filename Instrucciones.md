# Sistema de Comanda y Gestión de Ventas

## 1. Descripción del proyecto

Sistema web para gestionar las ventas, productos, inventario, clientes, créditos y movimientos financieros de un establecimiento.

El sistema contará con una página principal tipo landing page para presentar el negocio y posteriormente permitirá acceder al sistema de gestión mediante autenticación.

La aplicación estará dividida principalmente en:

* Landing Page
* Inicio / Dashboard
* Comanda
* Productos
* Categorías
* Inventario
* Clientes
* Créditos
* Historial de ventas
* Movimientos
* Configuración

---

# 2. Tecnologías

## Frontend

* Next.js
* TypeScript
* Radix UI
* Lucide Icons
* CSS / Tailwind CSS

## Backend

Se utilizará:

* Python
* FastAPI
* PostgreSQL
* SQLAlchemy
* Pydantic
* JWT para autenticación

El backend deberá estar completamente separado del frontend mediante una API REST.

---

# 3. Requerimientos funcionales

## RF-01 — Landing Page

El sistema deberá contar con una página principal tipo landing que incluya:

* Logo del negocio.
* Nombre del negocio.
* Descripción.
* Información general.
* Botón para acceder al sistema.
* Diseño responsive.

La landing no deberá interferir con el sistema administrativo.

---

## RF-02 — Autenticación

El sistema deberá permitir:

* Iniciar sesión.
* Cerrar sesión.
* Proteger las rutas administrativas.
* Mantener la sesión activa.
* Controlar el acceso al sistema.

---

## RF-03 — Dashboard

El sistema deberá contar con un dashboard principal que permita consultar:

* Ingresos.
* Egresos.
* Ganancias.
* Ventas realizadas.
* Productos vendidos.
* Productos con bajo stock.
* Créditos pendientes.
* Movimientos de inventario.
* Resumen del día.
* Resumen por períodos.

Los valores deberán calcularse a partir de la información almacenada en la base de datos.

---

# 4. Comanda

## RF-04 — Registrar venta

El usuario podrá crear una nueva venta mediante una comanda.

La venta deberá permitir:

* Buscar productos.
* Agregar productos.
* Modificar cantidades.
* Eliminar productos.
* Visualizar subtotal.
* Visualizar total.
* Seleccionar cliente.
* Seleccionar método de pago.
* Confirmar la venta.

Los métodos de pago serán:

* Efectivo.
* Nequi.
* Crédito.

---

## RF-05 — Actualización automática del stock

Cuando una venta sea confirmada:

* El stock de cada producto vendido deberá disminuir automáticamente.
* La cantidad descontada deberá corresponder a la cantidad vendida.
* No deberá ser posible vender una cantidad superior al stock disponible.

El movimiento deberá quedar registrado para mantener trazabilidad.

---

# 5. Productos

## RF-06 — Crear productos

El sistema deberá permitir crear productos con:

* Nombre.
* Descripción opcional.
* Precio de venta.
* Precio/costo de adquisición.
* Stock.
* Categoría.
* Estado.

El estado podrá ser:

* Activo.
* Deshabilitado.

---

## RF-07 — Editar productos

El administrador podrá modificar:

* Nombre.
* Descripción.
* Precio.
* Costo.
* Categoría.
* Stock.
* Estado.

Los cambios deberán persistir en la base de datos.

---

## RF-08 — Deshabilitar productos

Los productos no deberán eliminarse físicamente cuando ya tengan ventas asociadas.

En su lugar, podrán ser deshabilitados.

Un producto deshabilitado:

* No aparecerá como disponible para nuevas ventas.
* Mantendrá su historial.
* Mantendrá sus relaciones con ventas anteriores.

---

# 6. Categorías

## RF-09 — Gestión de categorías

El sistema deberá contar con un apartado independiente para administrar categorías.

Permitirá:

* Crear categorías.
* Editar categorías.
* Deshabilitar categorías.
* Consultar categorías.
* Asociar productos a categorías.

No se deberá eliminar una categoría que tenga productos relacionados sin manejar previamente dicha relación.

---

# 7. Inventario

## RF-10 — Control de inventario

El sistema deberá mantener actualizado el inventario.

Deberá registrar movimientos como:

* Entrada de inventario.
* Salida por venta.
* Ajuste de inventario.
* Toma por administración.

Cada movimiento deberá registrar:

* Producto.
* Cantidad.
* Tipo de movimiento.
* Fecha.
* Usuario responsable.
* Observación opcional.

---

# 8. Toma por administración

## RF-11 — Toma de producto por administración

El sistema deberá permitir registrar cuando administración toma productos del inventario para consumo, uso interno, muestras, eventos u otras actividades administrativas.

Este movimiento deberá:

* Disminuir el stock.
* Registrar el producto.
* Registrar la cantidad.
* Registrar la fecha.
* Registrar el usuario responsable.
* Registrar una observación opcional.

### Regla importante

Una toma por administración **NO deberá registrarse como ingreso ni como egreso financiero**.

Solamente afectará el inventario.

El movimiento deberá identificarse técnicamente como:

**Salida interna de inventario**

o

**Consumo interno**

Se recomienda utilizar `INTERNAL_USE` como tipo interno del movimiento.

---

# 9. Clientes

## RF-12 — Gestión de clientes

El sistema deberá permitir:

* Registrar clientes.
* Editar clientes.
* Consultar clientes.
* Ver historial de compras.
* Consultar créditos asociados.

Los datos mínimos podrán ser:

* Nombre.
* Teléfono.
* Identificador opcional.
* Estado.

---

## RF-13 — Autocompletado de clientes

Al registrar una venta, el sistema deberá permitir buscar un cliente mientras el usuario escribe.

Si el cliente ya existe:

* Deberá aparecer como sugerencia.
* Podrá seleccionarse sin volver a registrarlo.
* Sus datos deberán utilizarse automáticamente en la venta.

Ejemplo:

Cliente existente:

`Juan Pérez`

Al escribir:

`Juan`

El sistema deberá mostrar:

`Juan Pérez`

---

# 10. Créditos

## RF-14 — Registrar venta a crédito

El método de pago `Crédito` permitirá registrar una venta que será pagada posteriormente.

El crédito deberá almacenar:

* Cliente.
* Venta relacionada.
* Valor pendiente.
* Fecha de creación.
* Estado.
* Fecha de pago.

Estados:

* Pendiente.
* Pagado.

---

## RF-15 — Panel de créditos

El sistema deberá contar con un apartado exclusivo para consultar créditos.

Deberá mostrar:

* Cliente.
* Valor.
* Fecha.
* Venta relacionada.
* Estado.
* Fecha de pago.

Deberá permitir:

* Filtrar créditos pendientes.
* Consultar créditos pagados.
* Marcar un crédito como pagado.
* Consultar el historial.

Cuando un crédito sea marcado como pagado, deberá conservarse el registro histórico.

---

# 11. Historial

## RF-16 — Historial de ventas

El sistema deberá almacenar todas las ventas realizadas.

Cada venta deberá mostrar:

* Número de venta.
* Fecha.
* Cliente.
* Productos.
* Cantidades.
* Total.
* Método de pago.
* Usuario que realizó la venta.

Deberá permitir consultar ventas anteriores mediante filtros.

---

# 12. Movimientos financieros

## RF-17 — Ingresos

Los ingresos deberán generarse a partir de las ventas correspondientes.

El sistema deberá permitir consultar:

* Total de ingresos.
* Ingresos por período.
* Ingresos por método de pago.

---

## RF-18 — Egresos

El sistema deberá permitir registrar egresos reales del negocio.

Cada egreso deberá contener:

* Concepto.
* Valor.
* Fecha.
* Categoría opcional.
* Observación.
* Usuario responsable.

Los egresos deberán afectar los cálculos financieros del dashboard.

### Importante

Una salida interna de inventario o toma por administración **no deberá considerarse automáticamente un egreso financiero**.

---

# 13. Ganancias

## RF-19 — Cálculo de ganancias

El sistema deberá calcular las ganancias utilizando:

**Ganancia = Ingresos - Costos - Egresos**

El costo de cada producto vendido deberá utilizar el costo almacenado en el producto al momento de realizar el cálculo correspondiente.

---

# 14. Persistencia

## RF-20 — Persistencia de datos

Toda la información importante deberá almacenarse en PostgreSQL.

No se deberá depender de:

* LocalStorage como base de datos.
* Datos temporales.
* Arrays en memoria.
* Información simulada.

La información deberá mantenerse después de cerrar o reiniciar la aplicación.

---

# 15. Requerimientos no funcionales

## RNF-01 — Responsive

La interfaz deberá funcionar correctamente en:

* Computadores.
* Tablets.
* Teléfonos.

## RNF-02 — Usabilidad

La comanda deberá estar optimizada para realizar ventas rápidamente.

Las acciones frecuentes deberán requerir la menor cantidad posible de pasos.

## RNF-03 — Persistencia

Las operaciones deberán reflejarse inmediatamente en la base de datos.

## RNF-04 — Seguridad

Las rutas administrativas deberán estar protegidas.

Las operaciones sensibles deberán validar permisos y autenticación.

## RNF-05 — Trazabilidad

Los cambios importantes deberán permitir identificar:

* Qué ocurrió.
* Cuándo ocurrió.
* Qué usuario lo realizó.
* Sobre qué producto o venta ocurrió.

---

# 16. Casos de uso

## CU-01 — Iniciar sesión

**Actor:** Administrador / Usuario autorizado.

**Flujo:**

1. El usuario ingresa sus credenciales.
2. El sistema valida los datos.
3. Si son correctos, genera la sesión.
4. El sistema redirige al dashboard.

**Resultado:** Usuario autenticado.

---

## CU-02 — Registrar venta

**Actor:** Usuario autorizado.

**Flujo:**

1. El usuario abre la comanda.
2. Busca un producto.
3. Agrega el producto.
4. Define la cantidad.
5. Selecciona o registra el cliente.
6. Selecciona el método de pago.
7. Confirma la venta.
8. El sistema registra la venta.
9. El sistema descuenta el stock.
10. El sistema registra los movimientos correspondientes.

**Resultado:** Venta registrada y stock actualizado.

---

## CU-03 — Registrar cliente

**Actor:** Usuario autorizado.

**Flujo:**

1. El usuario inicia una venta.
2. Busca un cliente.
3. El cliente no existe.
4. Selecciona "Crear cliente".
5. Ingresa los datos.
6. Guarda el cliente.
7. El sistema lo asocia a la venta.

**Resultado:** Cliente registrado y asociado a la venta.

---

## CU-04 — Autocompletar cliente

**Actor:** Usuario autorizado.

**Flujo:**

1. El usuario inicia una venta.
2. Comienza a escribir el nombre del cliente.
3. El sistema busca coincidencias.
4. Muestra los clientes encontrados.
5. El usuario selecciona uno.
6. El sistema utiliza el cliente seleccionado.

**Resultado:** Cliente seleccionado sin registrarlo nuevamente.

---

## CU-05 — Registrar venta a crédito

**Actor:** Usuario autorizado.

**Flujo:**

1. El usuario registra los productos.
2. Selecciona un cliente.
3. Selecciona "Crédito".
4. Confirma la venta.
5. El sistema registra la venta.
6. El sistema descuenta el stock.
7. El sistema crea un crédito pendiente.

**Resultado:** Venta registrada y crédito creado.

---

## CU-06 — Marcar crédito como pagado

**Actor:** Usuario autorizado.

**Flujo:**

1. El usuario abre el panel de créditos.
2. Busca el crédito.
3. Selecciona "Marcar como pagado".
4. El sistema registra la fecha de pago.
5. Cambia el estado a `Pagado`.

**Resultado:** Crédito actualizado conservando su historial.

---

## CU-07 — Crear producto

**Actor:** Administrador.

**Flujo:**

1. Accede al apartado de productos.
2. Selecciona crear producto.
3. Ingresa nombre.
4. Ingresa precio.
5. Ingresa costo.
6. Ingresa stock.
7. Selecciona categoría.
8. Guarda el producto.

**Resultado:** Producto persistido en la base de datos.

---

## CU-08 — Editar producto

**Actor:** Administrador.

**Flujo:**

1. Busca un producto.
2. Selecciona editar.
3. Modifica la información.
4. Guarda los cambios.
5. El sistema actualiza el producto.

**Resultado:** Producto actualizado.

---

## CU-09 — Deshabilitar producto

**Actor:** Administrador.

**Flujo:**

1. Busca un producto.
2. Selecciona deshabilitar.
3. Confirma la acción.
4. El sistema cambia su estado.
5. El producto deja de estar disponible para nuevas ventas.

**Resultado:** Producto deshabilitado sin perder su historial.

---

## CU-10 — Registrar toma por administración

**Actor:** Administrador.

**Flujo:**

1. Accede a inventario.
2. Selecciona un producto.
3. Selecciona "Salida interna de inventario".
4. Ingresa la cantidad.
5. Agrega una observación opcional.
6. Confirma.
7. El sistema descuenta el stock.
8. Registra el movimiento como `INTERNAL_USE`.

**Resultado:** Stock actualizado sin generar ingreso ni egreso financiero.

---

## CU-11 — Registrar egreso

**Actor:** Administrador.

**Flujo:**

1. Accede a movimientos financieros.
2. Selecciona nuevo egreso.
3. Ingresa concepto.
4. Ingresa valor.
5. Selecciona categoría.
6. Confirma.
7. El sistema registra el egreso.

**Resultado:** Egreso incluido en los cálculos financieros.

---

## CU-12 — Consultar dashboard

**Actor:** Administrador / Usuario autorizado.

**Flujo:**

1. Accede al dashboard.
2. El sistema consulta la información.
3. Calcula ingresos.
4. Calcula egresos.
5. Calcula ganancias.
6. Muestra estadísticas.
7. Muestra alertas de inventario y créditos.

**Resultado:** El usuario obtiene una visión general del negocio.

---

# 17. Reglas de negocio

### RN-01 — Stock

El stock nunca deberá quedar por debajo de cero.

### RN-02 — Venta

Una venta confirmada no deberá desaparecer del historial.

### RN-03 — Producto

Un producto con historial de ventas deberá deshabilitarse en lugar de eliminarse físicamente.

### RN-04 — Crédito

Un crédito pendiente deberá estar asociado a una venta y a un cliente.

### RN-05 — Pago de crédito

Marcar un crédito como pagado no deberá eliminarlo del historial.

### RN-06 — Salida interna

Una `INTERNAL_USE` únicamente modifica inventario y no genera ingresos ni egresos financieros.

### RN-07 — Venta

Una venta debe descontar automáticamente las cantidades correspondientes del inventario.

### RN-08 — Cliente

Un cliente existente deberá poder reutilizarse en futuras ventas.

### RN-09 — Persistencia

Las operaciones confirmadas deberán almacenarse en PostgreSQL.

### RN-10 — Auditoría

Los movimientos de inventario y financieros deberán conservar información suficiente para conocer su origen.

---

# 18. Entidades principales

La base de datos deberá contemplar como mínimo:

* `users`
* `products`
* `categories`
* `customers`
* `sales`
* `sale_items`
* `inventory_movements`
* `financial_movements`
* `credits`

Relaciones principales:

```text
Category
   │
   └── Products
          │
          ├── Inventory Movements
          │
          └── Sale Items
                    │
                    └── Sale
                         │
                         ├── Customer
                         │
                         └── Credit
```

---

# 19. Arquitectura

```text
┌──────────────────────────────┐
│          Next.js             │
│                              │
│ Landing / Dashboard          │
│ Comanda                      │
│ Productos                    │
│ Clientes                     │
│ Créditos                     │
│ Inventario                   │
│ Historial                    │
└──────────────┬───────────────┘
               │
             REST API
               │
┌──────────────▼───────────────┐
│           FastAPI            │
│                              │
│ Auth                         │
│ Products                     │
│ Categories                   │
│ Customers                    │
│ Sales                        │
│ Credits                      │
│ Inventory                    │
│ Financial                    │
└──────────────┬───────────────┘
               │
            SQLAlchemy
               │
┌──────────────▼───────────────┐
│         PostgreSQL           │
└──────────────────────────────┘
```

---

# 20. Principio importante del sistema

El sistema deberá separar claramente tres conceptos:

### Ventas

Representan operaciones realizadas con clientes.

### Movimientos financieros

Representan dinero que entra o sale realmente del negocio.

### Movimientos de inventario

Representan cambios en las cantidades disponibles de productos.

Por lo tanto:

**Venta → modifica inventario y genera información financiera.**

**Egreso → modifica información financiera.**

**Salida interna / toma administrativa → modifica inventario, pero NO genera movimiento financiero.**

Esta separación deberá mantenerse tanto en el frontend como en el backend y en la base de datos.
