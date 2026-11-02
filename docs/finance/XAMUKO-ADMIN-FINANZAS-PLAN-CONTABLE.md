# XAMUKO Admin · Finanzas, contabilidad e impuestos
**Especificación de producto para revisión · v0.1 · 1 de noviembre de 2026**

> **Estado:** DISEÑO PROPUESTO; no implementado ni publicado. No sustituye el trabajo de un contador público ni constituye estados financieros certificados.  
> **Origen:** decisiones del fundador para XAMUKO. No modifica los estatutos ni el Registro Maestro de Decisiones.

## 1. Propósito y principios

XAMUKO Admin debe convertir información validada de suscripciones, publicidad, proveedores, facturas y bancos en:
- panel financiero y control presupuestal mensual;
- tesorería, calendario tributario y apartado de **25 % de la utilidad mensual**;
- libros y comprobantes contables de partida doble;
- estados financieros preliminares con trazabilidad, soportes, revisión y certificación profesional.

**Separaciones obligatorias:** facturación ≠ recaudo; ingresos devengados ≠ movimientos bancarios; consumos estimados ≠ facturas; gastos ≠ pagos; provisión tributaria ≠ reserva bancaria; estados preliminares ≠ estados certificados. Ningún valor se presume cero por ausencia de datos: usar «Sin datos» o «Pendiente de conciliar».

## 2. Catálogo aprobado de fuentes de ingresos

| Código funcional | Fuente | Evento principal | Observaciones |
| --- | --- | --- | --- |
| I-U-PRO | Suscripción Usuario PRO | derecho de uso durante el periodo contratado | distinguir cobro anticipado de ingreso devengado |
| I-U-PLUS | Suscripción Usuario PLUS | igual | precio y disponibilidad configurables |
| I-B-PRO | Suscripción Negocio PRO | igual | vincular negocio/plan/facturación |
| I-B-PLUS | Suscripción Negocio PLUS | igual | renovaciones, descuentos, notas crédito |
| I-GOOGLE | Monetización publicitaria de Google | ingresos efectivamente generados según liquidación conciliada | identificar producto real, habitualmente AdSense/AdMob. **Google Ads es compra de publicidad, un egreso**, no confundir |

Cada operación debe conservar ID del evento, ID de pasarela, negocio/usuario, plan, contrato, periodo de prestación, fecha de facturación, fecha de recaudo, subtotal, impuestos discriminados, comisión, retenciones, reembolsos, bruto, neto, moneda, TRM documentada, estado de conciliación y enlace al soporte. Evitar duplicidad entre webhook, renovación, factura y pago.

> La **activación del plan no prueba que haya recaudo**, ni un ingreso anual anticipado es íntegramente ingreso contable del primer mes. Parametrizar reconocimiento según el marco técnico aplicable.

## 3. Catálogo de egresos y compromisos

| Código | Fuente | Frecuencia esperada | Criterio |
| --- | --- | --- | --- |
| E-AWS | AWS (EC2, base de datos, almacenamiento, etc.) | mensual | presupuesto, consumo provisional, factura cerrada y pago diferenciados |
| E-MAPS | Google Maps Platform | mensual | uso y factura conciliados, posible moneda extranjera |
| E-OTROS | Proveedores adicionales, comisiones, bancos, dominios, profesionales, etc. | según comprobante real | solo si existen; sin inventar gastos |

Para cada proveedor: tercero, contrato, producto, centro de costos, periodo causado, vencimiento, soporte PDF/XML, total sin/impuestos, IVA descontable si aplica, retenciones, TRM, cuentas por pagar y pago. El costo «Unblended» de AWS y «Net Unblended» **no se suman** como si fueran dos gastos. Conciliar consumo provisional con factura.

## 4. Reserva mensual del 25 % de la utilidad

### Regla interna aprobada

`Utilidad_estimada_mes = Ingresos_contables_mes - Gastos_y_costos_contables_mes` (antes de impuesto a la renta; incluir ajustes de cierre que correspondan).

`Meta_reserva_mes = max(0, Utilidad_estimada_mes × 0,25)`.

- Si hay pérdida o utilidad cero, la meta nueva es $0; **no** liberar automáticamente saldos ya reservados.
- Proponer el traslado a una **cuenta/bolsillo bancario segregado**, exigir confirmación o evidencia del movimiento. La simple meta contable **no implica dinero apartado**.
- El traslado de fondos entre cuentas es un movimiento de tesorería y **no un gasto ni una reducción de la utilidad**.
- Recalcular al cerrar el mes y mostrar diferencia entre meta, dinero efectivamente reservado y obligaciones tributarias proyectadas.
- **Alerta de insuficiencia** cuando la estimación de impuestos/anticipos sea mayor que la reserva. El 25 % no se presenta como tasa de renta ni garantía de cobertura.
- Mantener IVA recaudado, retenciones y demás impuestos de terceros **separados** de esta reserva de renta. Una cifra como «utilidad después de reserva» es caja disponible teórica, **no utilidad neta contable**.

### Ejemplo ilustrativo, no cifras reales de XAMUKO

| Indicador | COP |
| --- | ---: |
| Ingresos reconocidos | 10.000.000 |
| Costos y gastos reconocidos | 4.000.000 |
| Utilidad preliminar antes de impuestos | 6.000.000 |
| Meta de reserva interna (25 %) | 1.500.000 |
| Dinero efectivamente transferido | 0 (hasta comprobar transferencia) |
| Impuesto a cargo | POR CALCULAR según régimen y base fiscal |

El régimen tributario se define después de constitución/RUT, con contador, y puede cambiar cálculos. No aplicar el 35 % sobre ingresos brutos ni confundir el régimen ordinario con SIMPLE.

## 5. Propuesta de navegación: Admin > Finanzas

1. **Resumen:** resultados por periodo, ingresos por canal, egresos por proveedor, margen, efectivo conciliado, reservas y alertas; indicadores con sello de calidad «real», «estimado», «pendiente», «conciliado».
2. **Ingresos:** Usuarios PRO/PLUS, Negocios PRO/PLUS, Google; detalle, facturas, recaudos, devoluciones y conciliación de pasarela.
3. **Egresos:** AWS, Google Maps, otros; presupuestos, consumos provisionales, facturas, obligaciones y pagos.
4. **Tesorería:** cuentas, movimientos bancarios, conciliación, traslados y saldo del bolsillo impuestos.
5. **Impuestos:** proyección fiscal, reserva 25 %, brecha, IVA, ICA, retenciones, anticipos y vencimientos configurados según realidad jurídica.
6. **Contabilidad:** catálogo de cuentas, asientos, diario, mayor, auxiliares, balance de comprobación y cierre mensual.
7. **Estados financieros:** estado de situación financiera, estado de resultados, notas y demás informes exigibles; comparativos, filtros y exportaciones PDF/XLSX. Borradores marcados **NO CERTIFICADO**.
8. **Soportes y auditoría:** facturas, comprobantes, versiones, trazabilidad de ediciones y revisiones.

En móviles, mostrar primero indicadores y acciones esenciales; no depender de tablas extensas sin adaptación. Las cifras monetarias en COP, con desglose en moneda de origen cuando exista.

## 6. Modelo contable y controles

- Plan de cuentas adaptado al marco técnico contable real aplicable a la S.A.S. (por determinar con contador, según criterios de clasificación); cuentas de efectivo/bancos, por cobrar, diferidos, por pagar, ingresos, gastos, impuestos y patrimonio.
- **Asientos equilibrados:** débitos = créditos, fuente rastreable y única, fechas de documento/devengo/pago diferenciadas.
- Factura, cobro y prestación de servicio crean eventos distintos; no duplicar la venta. Factura del proveedor, obligación y salida bancaria no duplican el gasto.
- Soportar anticipos y diferidos, ajustes y cierre de periodos; no borrar asientos contabilizados: reversión/ajuste con autorización y auditoría.
- **Estados sin certificación automática.** Revisión de contador público y certificación por representante legal y contador cuando corresponda, con actas de aprobación societaria independientes.
- Roles: preparador, aprobador de pagos, contador, auditor independiente cuando se justifique; mínimos privilegios, evidencia de quién, cuándo, por qué y qué cambió.
- No procesar, transferir ni reservar dinero real automáticamente; requerir cuenta conectada y consentimiento/aprobación expresa en la operación.
- Datos económicos del periodo **anterior a la constitución** diferenciados de transacciones de la sociedad; no atribuir a la S.A.S. pagos personales sin decisión y soporte.

## 7. Cierre mensual y anual

**Cierre mensual (lista de control):** verificar ingresos y devoluciones; cobrar/conciliar pasarela y Google; revisar cuentas por cobrar; contrastar AWS/Maps consumos vs facturas; registrar otras obligaciones; bancos conciliados; impuestos calculados; reserva 25 % calculada y traslado confirmado; ajustes y aprobaciones del contador; bloquear periodo.

**Cierre anual (31 de diciembre):** conciliaciones finales, revisión patrimonial, ajustes tributarios/contables separados, estados preliminares y notas, certificación profesional y trámite de aprobación en el órgano social, con calendario de reunión ordinaria (artículo 21 del borrador estatutario aprobado; **no altera su texto**).

## 8. Ejemplo de pantalla inicial (estructura, NO datos reales)

```text
XAMUKO ADMIN  /  FINANZAS                         Periodo: Mes ▾   [Exportar]

Ingresos reconocidos     Egresos reconocidos     Utilidad preliminar
        —                       —                       —

Suscripciones               Publicidad Google              Gastos
Usuarios PRO / PLUS         Liquidaciones y pagos          AWS / Google Maps / Otros
Negocios PRO / PLUS        Estado de conciliación         Estimado / Facturado / Pagado

RESERVA PARA IMPUESTOS (25 % DE UTILIDAD)
Meta del mes: —           Apartado real: —          Brecha fiscal: —
[Ver cálculo]              [Registrar transferencia verificada]

CONTABILIDAD Y CIERRE
Comprobantes pendientes: —    Conciliaciones: —   Estado: NO CERRADO
[Balance de prueba] [Estados preliminares] [Soportes]
```

## 9. Criterios de aceptación para implementar gradualmente

- [ ] Las cinco fuentes de ingresos tienen cuentas o etiquetas separadas, y sus cifras concilian con hechos soportados.
- [ ] Se distingue utilidad devengada de caja disponible; no se resta el 25 % como «gasto de impuestos».
- [ ] El objetivo del 25 % se recalcula cada mes; transferencias no realizadas jamás aparecen como dinero reservado.
- [ ] IVA/ICA/retenciones y obligaciones fiscales reales se calculan sin suposiciones; hay alerta cuando falta provisión o caja.
- [ ] Factura AWS/Maps y pagos no duplican un mismo gasto. Importes provisionales están claramente marcados.
- [ ] Contabilidad de partida doble cuadra; asientos tienen soporte, no se borran, reversos auditados.
- [ ] Cierre genera informes preliminares, no certificados; roles y revisiones explícitas.
- [ ] Exportación segura y controlada; pruebas para periodos sin movimientos, devoluciones, facturas USD, cambio de TRM, pérdida del mes, pago duplicado y ajustes de cierre.
- [ ] Se mantienen los módulos actuales y no se modifica la base de datos ni DNS/servidor sin autorización. La publicación se verificará en el dominio real, no solo por CI.

## 10. Implantación propuesta y decisiones por validar

**Etapa 1:** revisión de UX y fuente de datos. **Etapa 2:** modelo contable, ingresos y conciliación, migraciones seguras. **Etapa 3:** presupuesto, tesorería, reserva 25 %, calendario fiscal. **Etapa 4:** cierres, estados financieros, permisos y auditoría. **Etapa 5:** despliegue controlado con evidencia, respaldo y rollback.

**Pendiente de decisión técnica/jurídica:** entidad operadora y fecha de constitución; RUT/NIT/régimen tributario; banco y pasarela; plataforma Google que efectivamente pagará; contador responsable; precios y periodicidades de PRO/PLUS; marco contable Grupo 2/3 u otro si procede. No bloquear el diseño por esos datos, pero sí los cálculos o integraciones que dependen de ellos.

**Normas de referencia:** Ley 1314 de 2009; Decreto 2420 de 2015 y modificatorios; Ley 222 de 1995 (arts. 34, 36 y 37); Ley 1258 de 2008; Estatuto Tributario; disposiciones DIAN y territoriales aplicables. Verificar versiones y aplicabilidad al constituir la sociedad.

---
**Aislamiento jurídico:** este documento es de ingeniería/producto. No cambia estatutos, actas ni Registro Maestro de Decisiones.
