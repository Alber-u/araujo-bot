# Prueba · valor de la empresa (Gaviota 1, 111 y 303 del 3T, previsión) · 21/10/2026

Versión **0.9.0** del cálculo (`ara-os-dinero-empresa.cjs`). Rama `claude/stoic-ride-alyg7t` (araujo-bot y ara-os).

> **Importante:** desde el entorno donde se ha hecho el cambio **no hay acceso a producción** (ni Holded, ni la hoja,
> ni el token del panel). Esto **no** es todavía la prueba en producción: es la proyección sobre las cifras del panel
> del 21/10 (05:23 UTC, commit `09d1662b`) más una prueba automática con esas cifras
> (`lib/dinero-empresa-21-10.test.cjs`). Después del despliegue hay que lanzar `dinero-empresa?force=1` y rellenar
> la tabla «Después del despliegue» del final.

## 1 · Gaviota 1 contada dos veces → arreglado

- **Causa.** T4 solo restaba las facturas ligadas por número en la OT o por etiqueta de Holded. F260052 iba al
  contacto «COMUNIDAD DE PROPIETARIOS CL.GAVIOTA 1»: solo daba el aviso y no se restaba.
- **Arreglo** (`calcularT4`). Una factura cuyo contacto tiene **exactamente el mismo nombre** que la obra (normalizado:
  «Gaviota 1» = «COMUNIDAD DE PROPIETARIOS CL.GAVIOTA 1») se liga y se resta. Tiene que ser de los últimos 12 meses y
  no llevar ni el número ni la etiqueta de otra obra. Un nombre que solo se **parece** («CIUDAD DE CHIVA 7 EXTRAS»
  frente a «Chiva 7») sigue siendo solo un aviso, como antes. Cuando se liga así, sale un aviso ámbar para poner el
  número en la OT.
- **D14.** La comisión de Gaviota (612,94 €) **se mantiene**: la factura está emitida pero sin cobrar, y la comisión se
  paga al cobro.
- **«Falta facturar 112.309 €» frente a T4 121.010,06.** Las dos cifras salen del mismo detalle de T4. La diferencia
  (8.701 €) no era Gaviota: la alerta patrimonial cuenta las obras en fase 12-13 solo **por lo ejecutado**
  (horas reales ÷ horas previstas) y T4 cuenta el presupuesto entero. Con el arreglo **las dos bajan 8.915,04 €**.

## 2 · D9: el 111 del 3T → deuda hasta ver el cargo

- **Causa.** D9 = lo retenido en el trimestre en curso + el «arrastre» de la 4751. A partir del día 20, el trimestre
  anterior ya no contaba, aunque su cargo no estuviera importado. T1 va con el extracto, así que se contaba el dinero
  pero no la deuda.
- **Arreglo.** El 111 del trimestre vencido es deuda **hasta que su cargo esté en el banco importado**: un apunte
  bancario de la 572 o un movimiento sin conciliar de la foto. Para dar el cargo por encontrado:
  - con el importe del modelo, el cargo tiene que coincidir a ±0,05 €;
  - con el importe estimado del libro, tiene que ser un cargo de la AEAT a ±10 %.

  Importe que se usa, por orden:
  1. `config_dinero` **`modelos_aeat`** (el de Eplus);
  2. si no está, lo devengado en el libro durante ese trimestre: haber de la 4751, que `/obligaciones` devuelve ahora
     en `periodicos[].anterior`;
  3. si no hay ninguno, la estimación de siempre (`irpf_111_trimestral`).
- Mientras siga pendiente después del vencimiento sale un aviso ámbar: «Modelo 111 del 3T 2026 … sin cargo».

## 3 · D4: el 303 del 3T → solo sale con su cargo o aplazado

- Sigue en D4 hasta que haya un **cargo de la AEAT en el banco importado** por su importe.
- Si en `modelos_aeat` se marca **`aplazado`**, sale de D4 y **pasa a D3**. No pasa si `/obligaciones` ya lo trae como
  expediente.
- Hasta el día 20 no cambia nada: la lectura de `iva-trimestre` ya incluye el trimestre anterior.

## 4 · Previsión semanal

| Punto | Arreglo |
|---|---|
| DF 20 / Chiva 7 | Una obra terminada **sin factura** (T4) solo entra en el cash flow si la OT tiene **fecha de montaje**. La fecha de cobro es la de la OT (o 2 meses + día 5/20) y nunca antes de la próxima remesa. Sin montaje queda fuera, con la nota «Fuera hasta que haya factura y montaje: …». |
| Aquatubo | Un pago de `pagos_programados` que ya está en el banco importado (mismo importe ±0,05 €, desde 15 días antes de su fecha) ya no sale, y aparece la nota «… ya pagado el 13/10: quitarlo de pagos_programados». Conviene quitar la línea igualmente. |
| Cobros anunciados | Clave nueva **`cobros_anunciados`** (sin tocar código): `fecha:importe:concepto[:cierto\|posible][:Fnúmero]`. Con número de factura pendiente, el cobro sale de esa factura (el resto sigue a su remesa) y cuenta siempre como cierto. Un cobro `posible` entra marcado en la semana, y la tarjeta da también **la peor semana sin los posibles** (`minimo_sin_posibles`). |
| Siguiente pago grande | Ahora se busca **desde hoy**: con los datos del 21/10 es la cuota del Santander del 28/10, no la del 28/11. |
| 111 / 303 vencidos en el cash flow | Salen en su vencimiento (si ya pasó, hoy). Excepción: si el banco real ya va por detrás del extracto por ese importe, ya están cargados y sin importar, y no salen otra vez. Con el 21/10: el 111 no sale (los 6.758,93 € por detrás lo cubren) y el 303 sí. |
| 202 | Hay que poner `is_202_trimestral` (ver abajo). El de octubre ya pasó (20/10) y no sale; el siguiente es el 20/12. |

## 5 · Obras en fase 13 sin presupuesto

San Juan Bosco 6 (`OO-2026-129`), Diego Puerta Bajante (`OO-2026-153`) y Rafael Medina Bajante 1D (`OO-2026-154`):
**es un dato que falta en ARA-OS** (`pto_total` y coste previsto), no un fallo de código. El panel ya avisa.

## Líneas para `config_dinero` (hay que ponerlas a mano en la hoja)

| clave | valor |
|---|---|
| `modelos_aeat` | `111 3T 2026 5261,06; 303 3T 2026 2162,56` (si el 303 se aplaza: `… 2162,56 aplazado`) |
| `cobros_anunciados` | `2026-10-24:11555,17:Mandarinas 2 (mitad adelantada):cierto:F260050; 2026-10-31:19415:Urbano Orad 13-15 (resto):posible` ← **poner la fecha real de Mandarinas** |
| `is_202_trimestral` | `572,10` |
| `pagos_programados` | quitar `…:2341.93:Aquatubo` |

Cuando la factura del resto de Orad esté emitida en Holded, sale sola en «cobros de facturas». En ese momento hay que
quitar su línea de `cobros_anunciados`, o ponerle el número de factura.

## Proyección con las cifras del panel del 21/10

| | Panel 21/10 | Cambio | Proyección |
|---|---:|---:|---:|
| T4 Obra sin facturar | 121.010,06 | −8.915,04 (Gaviota 1) | **112.095,02** |
| D9 Retenciones | 13,55 | +5.261,06 (111 3T) | **5.274,61** |
| D4 IVA | 2.630,06 | +2.162,56 (303 3T) | **4.792,62** |
| **Valor normal** | 35.263,42 | −16.338,66 | **18.924,76** (≈ 18.900 ✅) |
| **Valor prudente** | 19.098,46 | −16.338,66 | **2.759,80** (≈ 2.800 ✅) |

Solo con el punto 1: 35.263,42 − 8.915,04 = **26.348,38** (≈ 26.348 ✅).

La proyección supone que `modelos_aeat` está puesta o que el libro tiene las retenciones del 3T en la 4751. Sin ninguna
de las dos, D9 se queda en 13,55 € y sale el aviso de «sin importe».

**Previsión** («mío» ≈ +4.800 el 03/11; ≈ −14.600 si Orad no entra): **no se puede proyectar desde aquí**. Depende de
todos los movimientos de las 4 semanas. Hay que comprobarlo después del despliegue con las líneas de arriba ya puestas.

## Prueba automática (`node lib/dinero-empresa-21-10.test.cjs`)

```
OK dinero-empresa-21-10.test · T4 Gaviota 0 · D9 5274.61 · D4 4792.62 · peor semana 31534.54 (sin posibles 12119.54)
```

Las cifras de la previsión de esta prueba son de un caso inventado, no de producción. La prueba comprueba:

- T4 de Gaviota a 0, con F260052 ligada por el contacto, y T3 con 50.920,51;
- Chiva 7 sin restar (solo aviso);
- D14 de Gaviota en 612,94;
- D9 = 5.274,61, tanto con `modelos_aeat` como con el libro; D9 = 13,55 con el cargo importado;
- D4 = 4.792,62; D4 = 2.630,06 con el cargo; con «aplazado», D4 = 2.630,06 y D3 + 2.162,56;
- DF 20 fuera; Aquatubo fuera; Mandarinas 11.555,17 cierto el 24/10 y el resto el 05/11; Orad 19.415 posible;
- 111 sin repetir y 303 hoy; 202 solo el 20/12; siguiente pago grande el 28/10 (15.075,06);
- `/obligaciones` da el 3T (111 = 5.261,06; 303 = 2.162,56) y nada del año anterior en enero.

Siguen pasando las 55 pruebas de `lib/*.test.cjs`. En `lib/cashflow-03-10.test.cjs` la obra terminada de ejemplo lleva
ahora fecha de montaje: es la regla nueva, y se añade el caso sin montaje.

La prueba e2e `test/fase14-relacion-tomas.e2e.test.cjs` falla **igual antes y después** del cambio («Faltan datos de
los certificados…»). No tiene que ver con esto.

## Después del despliegue (pendiente)

| Comprobación | Esperado | Real |
|---|---|---|
| `version` / `commit` | 0.9.0 / (nuevo) | |
| T4 sin Gaviota 1 | ≈ 112.095 | |
| T3 con F260052 | 50.920,51 | |
| D9 | ≥ 5.274,61 | |
| D4 | ≥ 4.792,62 | |
| Valor normal / prudente | ≈ 18.900 / ≈ 2.800 | |
| Previsión: DF 20 y Aquatubo fuera | sí | |
| «mío» el 03/11 (con Orad / sin Orad) | ≈ +4.800 / ≈ −14.600 | |
