# Marco Fiscal Argentino para Personas Físicas con Inversiones en el Exterior vía Broker Regulado

**Documento técnico de referencia para implementación de motor de cálculo fiscal automatizado**
**Fecha de vigencia del documento:** 24 de abril de 2026
**Período fiscal cubierto como foco principal:** 2025 (declaración y pago en 2026)
**Perfil objetivo:** persona física residente fiscal en Argentina, monotributista o inscripta en Ganancias, con entre USD 10.000 y USD 200.000 en un broker estadounidense regulado (Wallbit, Interactive Brokers, Schwab, etc.).

---

## Resumen Ejecutivo — Los 5 números que el sistema debe conocer hoy

1. **Mínimo no imponible Bienes Personales 2025:** **ARS 384.728.044,57** (estimación oficial/consensuada ajustada por IPC +31,3% interanual a octubre 2025; pendiente de publicación formal por ARCA al momento de este documento) [Source](https://blogdelcontador.com.ar/news-46363-bienes-personales-2025-a-partir-de-que-monto-se-pagara-con-el-aumento-del-313-en-los-minimos-y-escalas) [Source](https://evemuriel.com/blog/ganancias-y-bienes-personales/bienes-personales.html). Casa habitación: **ARS 1.346.548.155,99**.
2. **Alícuotas Bienes Personales 2025 (tabla unificada país+exterior, sin diferencial):** **0,50%, 0,75% y 1,00%** en tres tramos progresivos (el tramo del 1,25% fue eliminado a partir del período 2025 por Ley 27.743) [Source](https://www.lanacion.com.ar/politica/bienes-personales-que-cambia-en-el-impuesto-y-a-quienes-alcanza-en-el-proyecto-de-javier-milei-nid25062024/) [Source](https://www.cronista.com/economia-politica/ganancias-y-bienes-personales-como-quedan-las-escalas-y-minimos-de-los-impuestos/).
3. **Ganancia de capital por venta de acciones/ETFs extranjeros:** alícuota cedular plana **15%** sobre la ganancia neta en USD convertida a pesos (Art. 94 tercer párrafo, Ley 20.628 t.o. 2019) [Source](https://www.thomsonreuters.com.ar/es/soluciones-fiscales-contables-gestion/blog-contadores/impuesto-a-las-ganancias-como-simplificar-la-liquidacion.html).
4. **Dividendos e intereses de fuente extranjera (incl. cupones de T-Bills y distribuciones de ETFs de renta fija tipo SGOV/BIL/SHV):** escala progresiva del **Art. 94 primer párrafo LIG (5% a 35%)**, no cedular. Admite cómputo como pago a cuenta del impuesto análogo pagado en el exterior (withholding del 30% del IRS) con límite del incremento de la obligación fiscal argentina generado por esa renta [Source](https://trivia.consejo.org.ar/ficha/938-dictamen_dat_499._impuesto_a_las_ganancias._dividendos_distribuidos_por_una_sociedad_del_exterior_a_un_residente_del_pais._su_tratamiento) [Source](https://www.thomsonreuters.com.ar/es/soluciones-fiscales-contables-gestion/blog-contadores/impuesto-a-las-ganancias-como-simplificar-la-liquidacion.html).
5. **Tipo de cambio de valuación al 31/12 para Bienes Personales:** **USD comprador BNA divisa al último día hábil anterior al 31 de diciembre** (Dec. 127/96 reglamentario de Ley 23.966 y valuaciones anuales publicadas por ARCA) [Source](https://trivia.consejo.org.ar/ficha/519546-adr_y_cedear._tratamiento_en_el_impuesto_a_las_ganancias_y_en_bienes_personales._periodo_2023) [Source](https://www.afip.gob.ar/gananciasYBienes/bienes-personales/valuaciones/documentos/Bienes-Personales-2023/Anexo-II/PDF/Valuaciones-2023-Moneda-Extranjera.pdf).

**Dato cambiario de referencia oficial (2023):** USD comprador BNA al 29/12/2023 = **ARS 805,45**; vendedor = ARS 808,45 [Source](https://www.afip.gob.ar/gananciasYBienes/bienes-personales/valuaciones/documentos/Bienes-Personales-2023/Anexo-II/PDF/Valuaciones-2023-Moneda-Extranjera.pdf). ARCA publica la tabla oficial anual en su micrositio. El valor al 31/12/2025 deberá obtenerse de la tabla oficial ARCA 2025 (a publicarse entre mayo y junio de 2026) o de la API BCRA de Estadísticas Cambiarias para USD Billete/Divisa cotización mayorista/minorista.

---

## 1. BIENES PERSONALES — RÉGIMEN VIGENTE 2025

### 1.1 Base normativa
- **Ley 23.966, Título VI** (texto vigente), artículos 17, 19, 21, 22, 23, 24 y 25 [Source](https://www.argentina.gob.ar/sites/default/files/impuesto_sobre_los_bienes_personales_-_periodo_fiscal_al_2024.pdf).
- **Decreto reglamentario 127/1996** y modificatorias [Source](https://www.argentina.gob.ar/normativa/nacional/decreto-127-1996-33500/texto).
- **Ley 27.743 ("Medidas Fiscales Paliativas y Relevantes" / Paquete Fiscal 2024), Título III, arts. 45 a 65** [Source](https://servicios.infoleg.gob.ar/infolegInternet/anexos/400000-404999/401268/norma.htm).
- **Decreto 608/2024** reglamentario de Ley 27.743.
- **RG (AFIP/ARCA) 5544/2024 y 5588/2024** — reglamentación del REIBP [Source](https://www.boletinoficial.gob.ar/detalleAviso/primera/311999/20240809).

### 1.2 Mínimo no imponible 2025
- Período fiscal **2024: ARS 292.994.964,89** (confirmado por ARCA/Argentina.gob.ar) [Source](https://www.argentina.gob.ar/noticias/bienes-personales).
- Período fiscal **2025 (estimado al cierre de este documento): ARS 384.728.044,57** — aplicación del ajuste por IPC interanual a octubre 2025 (+31,3%) conforme al mecanismo de actualización anual incorporado por Ley 27.743 [Source](https://blogdelcontador.com.ar/news-46363-bienes-personales-2025-a-partir-de-que-monto-se-pagara-con-el-aumento-del-313-en-los-minimos-y-escalas). Valor ya utilizado como oficial por la comunidad tributaria para proyecciones y obligación de presentar DDJJ informativa de empleados en relación de dependencia (umbral: $196.963.134,52) [Source](https://evemuriel.com/blog/ganancias-y-bienes-personales/bienes-personales.html).
- **Casa habitación 2025:** ARS **1.346.548.155,99** (valor hasta el cual la vivienda principal está excluida de la base imponible) [Source](https://blogdelcontador.com.ar/news-46363-bienes-personales-2025-a-partir-de-que-monto-se-pagara-con-el-aumento-del-313-en-los-minimos-y-escalas).

> **⚠ ALERTA DE INCERTIDUMBRE:** al 24/04/2026 la resolución formal de ARCA que fija el MNI 2025 definitivo puede no estar publicada. El sistema debe parametrizar este valor y aceptar un override manual cuando salga la RG definitiva. Mantener `mni_bp_2025 = 384728044.57` como default tentativo.

### 1.3 Alícuotas 2025 — tabla unificada país + exterior (Art. 25 Ley 23.966, según Ley 27.743)

La Ley 27.743 **unificó el tratamiento de bienes en el país y en el exterior desde el período fiscal 2023**, eliminando la alícuota diferencial (antes hasta 2,25%) que sancionaba la no repatriación [Source](https://trivia.consejo.org.ar/ficha/524191-bienes_personales._eliminacion_de_la_alicuota_diferencial_para_bienes_en_el_exterior_sin_repatriacion). Para **2025**, el esquema elimina el tramo del 1,25% y queda con tres tramos [Source](https://www.lanacion.com.ar/politica/bienes-personales-que-cambia-en-el-impuesto-y-a-quienes-alcanza-en-el-proyecto-de-javier-milei-nid25062024/) [Source](https://www.cronista.com/economia-politica/ganancias-y-bienes-personales-como-quedan-las-escalas-y-minimos-de-los-impuestos/).

**Tabla general 2025 (aplicada sobre excedente del MNI $384.728.044,57):**

| Tramo | Base imponible (exceso sobre MNI) en ARS | Pagan | Más alícuota sobre excedente |
|---|---|---|---|
| 1 | Hasta ~ARS 52.660.000 | — | **0,50 %** sobre el excedente del MNI |
| 2 | Hasta ~ARS 114.100.000 | fijo tramo 1 + | **0,75 %** sobre excedente del límite inferior |
| 3 | Más de ~ARS 114.100.000 | fijo tramo 2 + | **1,00 %** sobre excedente del límite inferior |

Los montos exactos de los tramos 2025 se construyen aplicando el mismo coeficiente +31,3% a la tabla 2024 [Source](https://www.cronista.com/economia-politica/ganancias-y-bienes-personales-como-quedan-las-escalas-y-minimos-de-los-impuestos/).

**Beneficio Contribuyente Cumplidor (art. 64 Ley 27.743, RG 5535/2024):** –0,50 pp en cada alícuota para contribuyentes que presentaron y cancelaron íntegramente sus DDJJ de BP 2020, 2021 y 2022 antes del 31/12/2023 y **no adhirieron al blanqueo**. Resultado: alícuotas del **0% / 0,25% / 0,50%** en 2025 [Source](https://www.argentina.gob.ar/noticias/beneficios-tributarios-para-contribuyentes-cumplidores) [Source](https://www.cronista.com/economia-politica/ganancias-y-bienes-personales-como-quedan-las-escalas-y-minimos-de-los-impuestos/). El beneficio caduca para el período 2026.

> **⚠ ALERTA DE INCERTIDUMBRE — alícuotas 2025:** algunas fuentes periodísticas todavía publican tablas con 0,5% a 1,25% (heredadas del ejercicio 2024). La lectura correcta de la Ley 27.743 art. 64 es: **2024** → cuatro tramos (0,5/0,75/1/1,25); **2025** → tres tramos (0,5/0,75/1); **2026** → dos tramos (0,5/0,75); **2027** → alícuota única 0,25%. El motor debe usar una tabla **versionada por período fiscal**. Si al momento de cálculo no se cuenta con la RG de actualización de tramos 2025, aplicar los límites 2024 multiplicados por 1,313.

### 1.4 Valuación de activos del exterior (Art. 23 Ley 23.966)
- **Regla general para activos en el exterior:** **valor de plaza** (precio de mercado) al 31/12 del período fiscal, según legislación o prácticas del exterior [Source](https://trivia.consejo.org.ar/ficha/518678-impuesto_sobre_los_bienes_personales._valuacion_de_inmuebles_en_el_exterior).
- **Acciones y ETFs cotizantes en NYSE/NASDAQ:** valor de cotización al cierre del último día hábil del año calendario (31/12 o último día hábil anterior si es feriado). Se acepta el precio de cotización de mercado publicado (Yahoo Finance, Bloomberg, broker statement del 31/12). La posición del broker suele ser la fuente más confiable y auditable; ARCA admite la cotización oficial del mercado donde cotiza [Source](https://trivia.consejo.org.ar/ficha/519546-adr_y_cedear._tratamiento_en_el_impuesto_a_las_ganancias_y_en_bienes_personales._periodo_2023).
- **T-Bills y otros títulos con cotización:** **valor de cotización al 31/12** (no valor nominal ni costo). Si no hay cotización al 31/12 exacto, usar último precio disponible del año. En un T-Bill cerca del vencimiento y money-market funds, en la práctica coincide con el valor nominal.
- **Money-market funds y ETFs de renta fija (SGOV, BIL, SHV):** valor de cotización al 31/12. Generalmente ≈ NAV estable cercano a USD 100.
- **Efectivo/cash balance en cuenta broker (USD):** saldo USD × TC comprador BNA al último día hábil anterior al 31/12.

**Conversión a pesos (Art. 23 inc. a Ley 23.966 + Dec. 127/96 art. 14):** aplicar **tipo de cambio comprador (dólar divisa) del Banco Nación Argentina del último día hábil anterior al 31 de diciembre** del período fiscal [Source](https://trivia.consejo.org.ar/ficha/519546-adr_y_cedear._tratamiento_en_el_impuesto_a_las_ganancias_y_en_bienes_personales._periodo_2023) [Source](https://www.ambito.com/novedades-fiscales/bienes-personales-cuestiones-que-impactan-el-ejercicio-2023-y-alternativas-atenuar-su-carga-n5982072). ARCA publica el valor oficial por su micrositio de Valuaciones (históricos: 2022 $175,25; 2023 $805,45; 2024 a consultar) [Source](https://www.afip.gob.ar/gananciasYBienes/bienes-personales/valuaciones/documentos/Bienes-Personales-2023/Anexo-II/PDF/Valuaciones-2023-Moneda-Extranjera.pdf).

> **⚠ Zona gris frecuente:** ARCA publica una tabla oficial única (tipo comprador BNA divisa al último día hábil del año). Si el 31/12 es inhábil, se usa el último día hábil previo (típicamente 29 o 30 de diciembre). El sistema debe parametrizar esta fecha dinámicamente y consultar tabla ARCA o BCRA.

### 1.5 Activos exentos o no computables relevantes para este perfil
- **Títulos públicos argentinos** (Nación, provincias, municipios, CABA): **exentos** de BP y Ganancias [Source](https://www.afip.gob.ar/gananciasybienes/bienes-personales/conceptos-basicos/bienes-exentos.asp) [Source](https://www.infobae.com/economia/2025/10/14/impuestos-a-la-hora-de-invertir-que-hay-que-pagarle-a-arca-por-tener-acciones-bonos-depositos-y-otras-colocaciones/).
- **Acciones argentinas (que cotizan localmente)**: BP tributa por responsable sustituto (la sociedad). Para el tenedor persona física son **no computables**.
- **CEDEARs**: gravados en Bienes Personales (son activos argentinos, cotizan en MERVAL) [Source](https://reprodigital.com.ar/nota/953/ganancias_y_bienes_personales_como_tributan_los_cedears_y_los_adrs).
- **Acciones extranjeras y ETFs extranjeros** (lo relevante para este software): **gravados en BP** a alícuota unificada.
- **Plazos fijos y cuentas en bancos argentinos**: exentos de BP.
- **Dinero en efectivo en el exterior o en broker extranjero**: **gravado** en BP.

### 1.6 REIBP — Régimen Especial de Ingreso de Bienes Personales (Ley 27.743, Título III, Cap. I)
- Pago unificado y anticipado con alícuota **0,45% anual** (o 0,5% para bienes regularizados) sobre patrimonio al 31/12/2023, sustituyendo la obligación de BP de 2023–2027 (o 2024–2027 para bienes blanqueados) [Source](https://www.infobae.com/economia/2024/08/09/la-afip-reglamento-el-regimen-que-permite-anticipar-bienes-personales-quienes-pueden-adherirse-y-cuales-son-los-beneficios/).
- **Beneficio secundario: estabilidad fiscal hasta 2038** con alícuota tope del 0,25% sobre BP y todo tributo nacional al patrimonio [Source](https://trivia.consejo.org.ar/ficha/522712-estabilidad_fiscal_periodo_2028_-_2038).
- **Plazos: CERRADOS** — la opción de adhesión venció el 30/09/2024 (bienes no regularizados, prorrogada hasta 31/10/2024 por RG 5588/2024) y el 31/03/2025 (bienes regularizados) [Source](https://trivia.consejo.org.ar/ficha/521831-afip_reglamenta_el_regimen_especial_de_ingreso_de_bienes_personales).
- **Relevancia para este perfil:** la gran mayoría de contribuyentes con USD 10.000–200.000 no adhirió (costo de caja elevado y perfil no justificaba el régimen). El motor debe ofrecer una **bandera binaria `reibp_adherido`**: si es `true`, suprimir el cálculo de BP 2023–2027 y mostrar solo información. Si es `false` (default), calcular BP normal.

### 1.7 Cambios relevantes últimos 3 años
| Período | Cambio principal | Norma |
|---|---|---|
| 2022 | Aún vigente diferencial bienes exterior (hasta 2,25%) | Ley 27.541 |
| 2023 | Eliminación diferencial país/exterior; alícuotas 0,5%–1,5%; MNI $27,37 M | Ley 27.743 (retroactiva a 2023) |
| 2024 | MNI $292.994.964,89; alícuotas 0,5%–1,25% | Ley 27.743 + RG 5544/2024; blanqueo (hasta abril/julio 2025) |
| 2025 | MNI $384.728.044,57 (est.); alícuotas 0,5%–1% | Ley 27.743 Art. 64 |
| 2026 | Alícuotas previstas 0,5% y 0,75% | Ley 27.743 |
| 2027 | Alícuota única 0,25%; desaparecen tramos | Ley 27.743 |

---

## 2. GANANCIAS — DIVIDENDOS DE FUENTE EXTRANJERA

### 2.1 Gravabilidad
Los dividendos pagados por sociedades constituidas/domiciliadas en el exterior (Apple, Microsoft, Coca-Cola, etc.) a una persona humana residente fiscal argentina son **ganancias de segunda categoría de fuente extranjera gravadas** (Arts. 2, 44 inc. a, 137 y 140 LIG texto ordenado 2019) [Source](https://trivia.consejo.org.ar/ficha/938-dictamen_dat_499._impuesto_a_las_ganancias._dividendos_distribuidos_por_una_sociedad_del_exterior_a_un_residente_del_pais._su_tratamiento) [Source](https://www.cpceer.org.ar/sites/default/files/documentos/consultas-impositivas/tratamiento-tributario-sociedades-del-exterior-ig-y-bp-y-reg-informacion.pdf).

**No aplica** la exención del antiguo Art. 46 LIG (dividendos de fuente argentina no computables) a dividendos del exterior — Dictamen DAT 4/99 y doctrina pacífica [Source](https://trivia.consejo.org.ar/ficha/938-dictamen_dat_499._impuesto_a_las_ganancias._dividendos_distribuidos_por_una_sociedad_del_exterior_a_un_residente_del_pais._su_tratamiento).

### 2.2 Alícuota
**Escala progresiva del Art. 94 primer párrafo LIG** (tabla RIPTE ajustada anualmente, 5% a 35%) [Source](https://leyes-ar.com/ley_de_impuesto_a_las_ganancias/94.htm). **No se aplica la alícuota cedular del 15%** del tercer párrafo del Art. 94 porque esta última está reservada para la *enajenación* de valores, no para rendimientos [Source](https://www.thomsonreuters.com.ar/es/soluciones-fiscales-contables-gestion/blog-contadores/impuesto-a-las-ganancias-como-simplificar-la-liquidacion.html) [Source](https://trivia.consejo.org.ar/ficha/521438-cuaderno_profesional_nro._137._impuesto_a_las_ganancias_e_impuesto_sobre_los_bienes_personales._personas_humanas_y_sucesiones_indivisas._periodo_fiscal_2023).

ARCA publica la tabla Art. 94 anual (PDF) — por ejemplo para 2024 y para enero-junio 2026 [Source](https://www.afip.gob.ar/gananciasYBienes/ganancias/personas-humanas-sucesiones-indivisas/declaracion-jurada/documentos/Tabla-art-94-liquidacion-anual-final-2024.pdf) [Source](https://www.afip.gob.ar/gananciasYBienes/ganancias/personas-humanas-sucesiones-indivisas/declaracion-jurada/documentos/Tabla-Art-94-LIG-per-ene-a-jun-2026.pdf).

### 2.3 Imputación temporal — fecha de devengamiento
Los dividendos del exterior se imputan al **año fiscal en que fueron "puestos a disposición"** (pay date, no record date) (Art. 130 y 133 LIG) [Source](https://www.cpceer.org.ar/sites/default/files/documentos/consultas-impositivas/tratamiento-tributario-sociedades-del-exterior-ig-y-bp-y-reg-informacion.pdf). El criterio es **percibido** para personas humanas.

### 2.4 Tipo de cambio de conversión
**Tipo de cambio comprador BNA divisa del día de puesta a disposición** (Art. 132 LIG y Art. 165 VI Dec. 1344/98). La doctrina del Consejo Profesional lo reafirma para ADRs/CEDEARs y por analogía para dividendos del exterior: *"se consideran al tipo de cambio comprador BNA divisa del momento de la puesta a disposición"* [Source](https://trivia.consejo.org.ar/ficha/519546-adr_y_cedear._tratamiento_en_el_impuesto_a_las_ganancias_y_en_bienes_personales._periodo_2023).

> **⚠ Zona gris:** algunos tributaristas admiten usar el TC **vendedor** cuando se tratan costos o inversiones; para **ingresos y deducciones** se usa comprador o vendedor del día del devengo según corresponda al tipo de operación (Art. 158 LIG). Para dividendos (ingreso cobrado en USD) → **comprador**. El motor debe parametrizar: `tc_dividendos_extranjeros = BNA_divisa_comprador(fecha_pago)`.

### 2.5 Crédito por impuesto análogo pagado en el exterior (withholding 30% IRS)
- Argentina y EE.UU. **NO tienen convenio de doble imposición vigente** (CDI). El acuerdo firmado en 1981 nunca fue ratificado. El IGA FATCA de 2022 es un acuerdo de **intercambio de información**, NO un CDI [Source](https://www.bloomberglinea.com/2022/12/14/fatca-que-dice-el-memorandum-de-argentina-sobre-el-intercambio-de-informacion-financiera-con-eeuu/).
- No obstante, **Arts. 1, 165 y 166 LIG** permiten computar como **pago a cuenta** los gravámenes análogos efectivamente pagados en el exterior sobre rentas de fuente extranjera, **hasta el límite del incremento de la obligación fiscal argentina originado por la incorporación de dicha ganancia** [Source](https://trivia.consejo.org.ar/ficha/938-dictamen_dat_499._impuesto_a_las_ganancias._dividendos_distribuidos_por_una_sociedad_del_exterior_a_un_residente_del_pais._su_tratamiento).
- Para el inversor promedio con alícuota marginal argentina 27%–35%, el withholding del 30% típicamente queda **totalmente absorbido** por el impuesto argentino. Si la alícuota marginal argentina es 15%, solo se puede computar el crédito hasta ese 15%: el exceso se pierde.

**Fórmula aproximada:**
```
credito_fiscal = min(withholding_USA_en_ARS, alicuota_marginal_AR * dividendo_bruto_ARS)
impuesto_neto_AR = impuesto_escala_94 - credito_fiscal
```

### 2.6 Dividendos de ETFs de renta fija (SGOV, BIL, SHV, TLT, AGG)
Las distribuciones de ETFs estadounidenses, aunque subyacentemente sean intereses de Treasuries, se **distribuyen legalmente como "dividends"** (en el 1099-DIV del broker) y, desde la perspectiva fiscal argentina, se tratan como **dividendos de fuente extranjera** → Art. 94 primer párrafo, escala progresiva [Source](https://www.thomsonreuters.com.ar/es/soluciones-fiscales-contables-gestion/blog-contadores/impuesto-a-las-ganancias-como-simplificar-la-liquidacion.html).

> **⚠ Zona gris crítica:** algunos especialistas argumentan que las distribuciones "interest dividends" de ETFs de Treasuries podrían caracterizarse como intereses (con el mismo tratamiento fiscal AR, escala progresiva), pero esto no cambia el resultado. **La distinción fiscal en Argentina entre dividendo e interés de fuente extranjera es irrelevante cuanto a alícuota** (ambas van a escala Art. 94). Sólo importa distinguir para determinar si el 30% WHT de EE.UU. corresponde (en T-Bills directas no hay WHT; en ETFs sí, salvo excepciones de "portfolio interest").

---

## 3. IMPUESTO CEDULAR — RENDIMIENTOS DE TÍTULOS EXTRANJEROS

### 3.1 Marco general
Para personas humanas residentes:
- **Impuesto cedular local** (Art. 95 LIG, Cap. III Título IV): aplica sobre rendimientos y enajenaciones **de fuente argentina** de acciones, valores, títulos, bonos, FCI, monedas digitales, inmuebles. Alícuotas 5% / 15% según tipo de instrumento y moneda [Source](https://www.afip.gob.ar/impuesto-cedular/definiciones/).
- **Para rendimientos de fuente extranjera (Título IX LIG)**: **NO aplica el régimen cedular local**. Se aplica el régimen general del Art. 94 (primer párrafo escala progresiva para rendimientos; tercer párrafo 15% para resultados de enajenación) [Source](https://estudioecharren.com.ar/aspectos-tributarios-del-impuesto-a-las-ganancias-renta-financiera-de-fuente-extranjera/).

### 3.2 Intereses de T-Bills (Treasury Bills directos, no vía ETF)
Intereses de títulos públicos **extranjeros** (T-Bills, T-Notes, T-Bonds, munis USA) son **rendimientos de fuente extranjera** (Art. 137 y 140 LIG). Alícuota: **escala progresiva Art. 94 primer párrafo** [Source](https://estudioecharren.com.ar/aspectos-tributarios-del-impuesto-a-las-ganancias-renta-financiera-de-fuente-extranjera/).

**Particularidad T-Bills:** se emiten con descuento y no pagan cupón. El "interés" = diferencia entre precio de emisión y valor nominal al vencimiento. El criterio imputable es **percibido** (cuando se cobra el valor nominal o se vende antes de vencimiento). En una venta antes de vencimiento, la "cláusula antielusión" del Art. 233 DR LIG discrimina intereses corridos de los últimos 15 días [Source](https://www.thomsonreuters.com.ar/es/soluciones-fiscales-contables-gestion/blog-contadores/impuesto-a-las-ganancias-como-simplificar-la-liquidacion.html).

### 3.3 Distribuciones de ETFs de renta fija (SGOV, BIL, SHV)
Como en §2.6: se tratan como **dividendos de fuente extranjera** → Art. 94 primer párrafo, escala progresiva.

### 3.4 Diferencia con dividendos de acciones
Al nivel de alícuota argentina: **ninguna** (ambos → escala Art. 94). La diferencia está en:
- **Withholding en EE.UU.:** dividendos USA → 30% WHT por default (reducible por tratado; Argentina no tiene). Intereses de T-Bills directas a inversor extranjero no-residente → **0% WHT** (exentos bajo "portfolio interest" exemption). Distribuciones de ETFs → variable según estructura del ETF (SGOV típicamente sufre WHT por ser "dividend").
- **Argentina no obliga a discriminar** la fuente al calcular el impuesto argentino (todos a escala), pero el cómputo del crédito fiscal por WHT solo aplica al impuesto realmente retenido.

---

## 4. RESULTADO POR VENTA DE ACCIONES / ETFs EXTRANJEROS

### 4.1 Gravabilidad y alícuota
La enajenación de acciones, ADRs, ETFs y demás valores del exterior por personas humanas residentes argentinas es **ganancia de fuente extranjera gravada** (Título IX LIG). **Alícuota plana 15% sobre ganancia neta** (Art. 94 tercer párrafo LIG) [Source](https://www.thomsonreuters.com.ar/es/soluciones-fiscales-contables-gestion/blog-contadores/impuesto-a-las-ganancias-como-simplificar-la-liquidacion.html) [Source](https://estudioecharren.com.ar/aspectos-tributarios-del-impuesto-a-las-ganancias-renta-financiera-de-fuente-extranjera/).

**No aplica la exención del Art. 26 inc. u) LIG**, que está limitada a valores que coticen en mercados argentinos regulados por CNV (BYMA, MAE). NYSE/NASDAQ no encuadran.

### 4.2 Cálculo del resultado (Art. 154 y 158 LIG)
```
precio_venta_ARS = precio_venta_USD × TC_vendedor_BNA(fecha_venta)
costo_computable_ARS = precio_compra_USD × TC_vendedor_BNA(fecha_compra)
ganancia_gravada_ARS = precio_venta_ARS − costo_computable_ARS
impuesto = 0,15 × ganancia_gravada_ARS
```

**Criterio del tipo de cambio (Art. 158 LIG y Art. 145.1 DR):**
- **Precio de venta**: TC **vendedor BNA** día de la enajenación.
- **Costo computable (inversión)**: TC **vendedor BNA** día de la adquisición [Source](https://estudioecharren.com.ar/aspectos-tributarios-del-impuesto-a-las-ganancias-renta-financiera-de-fuente-extranjera/).
- **Efecto importante:** al usar el mismo criterio (vendedor) en ambos extremos y convertir en USD la operación, la "diferencia de cambio" pura queda **fuera del impuesto** (moneda dura, Art. 98 cuarto párrafo LIG). Solo se grava la ganancia real en USD [Source](https://estudioecharren.com.ar/aspectos-tributarios-del-impuesto-a-las-ganancias-renta-financiera-de-fuente-extranjera/).

En la práctica, el cálculo equivalente y correcto es:
```
ganancia_USD = precio_venta_USD − costo_USD
ganancia_ARS = ganancia_USD × TC_vendedor_BNA(fecha_venta)
impuesto = 0,15 × ganancia_ARS
```

### 4.3 Identificación del costo — método de imputación
La LIG no fija un método único obligatorio; en la práctica, se acepta **FIFO** (first-in-first-out) como criterio razonable y consistente. Algunos tributaristas admiten **promedio ponderado**, pero debe mantenerse consistentemente. El método debe ser parametrizable en el motor [Source](https://www.cpceer.org.ar/sites/default/files/documentos/consultas-impositivas/tratamiento-tributario-sociedades-del-exterior-ig-y-bp-y-reg-informacion.pdf).

> **⚠ Diseño recomendado:** configurar `metodo_costo = "FIFO" | "promedio_ponderado"` como setting del usuario, con FIFO como default por alineación con lo que reportan la mayoría de brokers US en su 1099-B.

### 4.4 Compensación de quebrantos (Art. 132 LIG)
Los quebrantos por enajenación de acciones, valores, bonos, cuotas, FCI, etc. **de fuente extranjera son quebrantos específicos**: solo pueden compensarse con ganancias del mismo tipo y fuente, en el mismo año fiscal y en los **5 años siguientes** [Source](https://servicios.infoleg.gob.ar/infolegInternet/anexos/330000-334999/332890/texact.htm). No pueden compensarse contra dividendos, salarios, honorarios, alquileres ni contra resultados de fuente argentina.

### 4.5 Beneficio de activos blanqueados bajo Ley 27.743 (Título II)
Para quien adhirió al blanqueo, el **costo computable** de los bienes sincerados se eleva al **valor de cotización al 31/12/2023** ("Fecha de Regularización"), no al costo histórico (Art. 27.2 Ley 27.743). Esto reduce significativamente la ganancia gravable en futuras ventas [Source](https://www.thomsonreuters.com.ar/es/soluciones-fiscales-contables-gestion/blog-contadores/impuesto-a-las-ganancias-como-simplificar-la-liquidacion.html).

---

## 5. TIPO DE CAMBIO — CRITERIOS NORMATIVOS

### 5.1 Tabla de criterios por operación

| Operación | Tipo de cambio | Fecha | Referencia |
|---|---|---|---|
| Bienes Personales — valuación 31/12 | **BNA divisa comprador** | Último día hábil anterior al 31/12 | Art. 23 inc. a Ley 23.966; Dec. 127/96 |
| Dividendos fuente extranjera | **BNA divisa comprador** | Día de puesta a disposición (pay date) | Art. 132 LIG; Dec. 1344/98 |
| Intereses T-Bills, cupones | **BNA divisa comprador** | Día de cobro / percepción | Art. 132 LIG |
| Venta de acciones/ETFs — precio venta | **BNA divisa vendedor** | Día de la enajenación | Art. 158 LIG; Art. 145.1 DR |
| Compra de acciones/ETFs — costo computable | **BNA divisa vendedor** | Día de adquisición | Art. 158 LIG |
| Withholding tax USA (crédito fiscal) | **BNA divisa comprador** | Día de retención (≈ día de cobro) | Art. 165 LIG |

> **⚠ Ambigüedad común:** muchos asesores usan BNA "billete" en vez de "divisa". La normativa pide **divisa** (transferencias). Diferencia spread típica: 1–3%. El motor debe usar **BNA divisa** estrictamente.

### 5.2 Fuentes oficiales
- **Fuente primaria oficial:** **ARCA** publica tabla anual de valuación de moneda extranjera al 31/12 en su micrositio Ganancias y Bienes Personales [Source](https://www.afip.gob.ar/gananciasYBienes/bienes-personales/valuaciones/).
- **Banco Central de la República Argentina — API Estadísticas Cambiarias (oficial y pública):** `https://estadisticas-cambiarias.bcra.apidocs.ar/` — endpoints para cotizaciones por fecha y evolución histórica. Lanzada en agosto 2024 [Source](https://www2.bcra.gob.ar/noticias/BCRA-API-estadisticas-cambiarias.asp) [Source](https://estadisticas-cambiarias.bcra.apidocs.ar/).
- **Banco de la Nación Argentina:** `https://www.bna.com.ar/Cotizador/HistoricoPrincipales` — publicación diaria histórica, scrapeable.
- **API comunitaria `estadisticasbcra.com`:** requiere token, provee JSON histórico; útil como redundancia [Source](https://estadisticasbcra.com/api/documentacion).

**Recomendación para el motor:** source principal BCRA API oficial; fallback scraping BNA; validación cruzada con tabla ARCA al cierre de año.

---

## 6. CRS Y OBLIGACIONES DE INFORMACIÓN

### 6.1 CRS — Common Reporting Standard
- **CRS (OCDE)** es el estándar global de intercambio automático de información financiera. Argentina participa desde 2017 con más de 100 jurisdicciones [Source](https://www.bloomberglinea.com/2022/12/14/fatca-que-dice-el-memorandum-de-argentina-sobre-el-intercambio-de-informacion-financiera-con-eeuu/).
- **EE.UU. NO es país CRS.** Usa su propio régimen: **FATCA**.

### 6.2 FATCA — Acuerdo IGA Modelo 1 Argentina-EE.UU.
- **Firma:** 5/12/2022 por Sergio Massa y Marc Stanley [Source](https://www.ambito.com/economia/argentina/cuentas-declarar-eeuu-entro-vigencia-el-acuerdo-intercambio-informacion-n5620390).
- **Entrada en vigor:** **1 de enero de 2023** [Source](https://mercojuris.com/memorandum-intercambio-de-informacion-financiera-entre-argentina-y-eeuu-fatca-firma-de-acuerdo-intergubernamental-modelo-1-iga-modelo-1/).
- **Validación técnica por IRS:** mayo 2024 (Argentina cumple data-security) [Source](https://blog.transworldcompliance.com/en/5-keys-to-understanding-the-fatca-agreement-between-argentina-and-us).
- **Primer intercambio automático:** septiembre 2024, por datos del **año calendario 2023** [Source](https://www.innovation.tax/blog/acuerdo-de-intercambio-de-informacion-entre-argentina-y-ee-uu). Intercambios sucesivos anuales al 30 de septiembre.
- **Información que EE.UU. envía a ARCA:**
  - Nombre, dirección, CUIT/CUIL del titular residente argentino.
  - Identificación de la institución financiera estadounidense.
  - **Montos brutos de intereses, dividendos y otras rentas de fuente estadounidense** acreditados durante el año calendario.
  - **Umbral:** cuenta reportable = que haya acreditado **más de USD 10** en intereses o dividendos en el año [Source](https://www.innovation.tax/blog/acuerdo-de-intercambio-de-informacion-entre-argentina-y-ee-uu) [Source](https://untitled-slc.com/wp-content/uploads/2024/04/INTERCAMBIO_INFO_EEUU_3_2024.pdf).
  - **NO se informan saldos de cuentas ni resultados de venta** [Source](https://abogados.com.ar/las-implicancias-del-acuerdo-de-intercambio-de-informacion-fatca-firmado-entre-argentina-y-estados-unidos/32159).

### 6.3 CRS 2.0
La OCDE aprobó en 2023 la actualización de CRS con cobertura ampliada a criptoactivos (CARF) y mejoras en debida diligencia. Implementación progresiva entre 2026 y 2027 según jurisdicción. Argentina acompaña pero sin cronograma legislativo específico publicado al cierre de este documento. **Relevancia para el perfil:** brokers crypto y neobrokers con cuenta en jurisdicciones CRS-compliant reportarán.

### 6.4 ¿Ya tiene ARCA la información del portfolio?
**Parcialmente sí**, pero con limitaciones:
- ARCA **sí conoce**, por intercambio FATCA desde septiembre 2024: identidad del titular argentino, institución financiera, **intereses y dividendos brutos 2023, 2024 y 2025** (el intercambio de septiembre 2026 cubrirá 2025) [Source](https://www.ambito.com/opiniones/sergio-massa/fatca-que-dice-la-letra-chica-del-acuerdo-y-que-puede-pasar-los-contribuyentes-argentinos-n5604598).
- ARCA **NO conoce** automáticamente: saldos, ganancia/pérdida por venta (1099-B no se intercambia), tenencia de activos a fecha determinada.
- Para estructuras LLC / sociedades con beneficiario final argentino, el reporte depende de si la LLC presentó W-9 (en ese caso no hay reporte a Argentina) o W-8 personal (sí se reporta).

**Obligación del contribuyente:** declaración proactiva siempre. El IGA NO sustituye la obligación del contribuyente de declarar en su DDJJ de Ganancias y Bienes Personales.

---

## 7. CALENDARIO FISCAL RELEVANTE

### 7.1 Período fiscal 2025 — vencimientos en 2026

**Bienes Personales + Ganancias Personas Humanas + Impuesto Cedular — DDJJ determinativa y pago (junio 2026):**

| Terminación CUIT | Presentación DDJJ | Pago |
|---|---|---|
| 0, 1, 2, 3 | 11/06/2026 | 12/06/2026 |
| 4, 5, 6 | 12/06/2026 | 15/06/2026 (lunes) |
| 7, 8, 9 | 15/06/2026 | 16/06/2026 |

Fuente: Cronograma ARCA publicado (confirmado por El Cronista, Calcular Sueldo, evemuriel.com) [Source](https://www.cronista.com/columnistas/ganancias-bienes-personales-e-iva-guia-completa-de-vencimientos-arca-para-cada-perfil-de-contribuyente/) [Source](https://calcularsueldo.com.ar/impuestos/13614/vencimientos-arca-2026-calendario-completo-de-impuestos-para-no-pagar-multas.html) [Source](https://evemuriel.com/blog/ganancias-y-bienes-personales/bienes-personales.html).

**DDJJ informativa (empleados en relación de dependencia con ingresos brutos ≥ $196.963.134,52):** hasta **30/06/2026** [Source](https://www.afip.gob.ar/gananciasybienes/bienes-personales/declaracion-jurada/vencimientos.asp).

### 7.2 Anticipos de Ganancias y Bienes Personales 2025
- **Cinco anticipos del 20%** cada uno (ART. 27 RG anticipos), con vencimientos entre el 13 y 15 de agosto 2025, octubre 2025, diciembre 2025, febrero 2026 y abril 2026 [Source](https://www.cronista.com/columnistas/ganancias-bienes-personales-e-iva-guia-completa-de-vencimientos-arca-para-cada-perfil-de-contribuyente/).
- Base de cálculo: 20% del impuesto determinado del período anterior.

### 7.3 Fecha de cierre del año fiscal
**31 de diciembre de cada año calendario** — para personas humanas residentes argentinas (Art. 24 LIG).

---

## 8. ESCENARIOS DE OPTIMIZACIÓN LEGAL

### 8.1 Tax-loss harvesting
- **NO existe en Argentina una "wash-sale rule"** formal equivalente a la del IRS (US §1091). La LIG no prohíbe recomprar el mismo activo al día siguiente de venderlo con pérdida.
- **Aplicabilidad:** un inversor argentino puede vender con pérdida en diciembre, reconocer el quebranto específico (Art. 132), y recomprar inmediatamente sin impacto fiscal argentino adverso.
- **Pero atención:** si el broker está en EE.UU. (Schwab, IBKR, Wallbit), **el IRS sí aplica wash-sale de 30 días a persons non-residents?** El wash-sale rule del IRS se aplica a U.S. persons; los residentes argentinos (generalmente NRA) no están sujetos a wash-sale del IRS. Sin embargo, puede afectar cost-basis en 1099-B emitido por el broker, con implicancias si se cambia de residencia fiscal.
- **Limitación argentina:** el quebranto es **específico** (Art. 132 LIG): solo compensa ganancias de la misma naturaleza (enajenación de valores) en el mismo año o en los 5 siguientes.

> **⚠ Zona gris:** no hay jurisprudencia argentina sobre abuso de tax-loss harvesting. La doctrina mayoritaria considera que no hay antiabuso específico. Se recomienda dejar al menos 1–2 días entre venta y recompra para evitar futuros conflictos interpretativos.

### 8.2 Timing de venta antes/después 31/12 para Bienes Personales
- **Activos en efectivo USD al 31/12 están gravados**, los activos en broker también. No hay arbitraje fácil vía "transformar a efectivo argentino" (el dinero en pesos en caja de ahorro argentina sí está exento, pero implica salir de USD).
- **Plazos fijos argentinos en USD en banco argentino: EXENTOS de BP** (Art. 21 Ley 23.966). Esto sí habilita arbitraje: transferir USD al país antes del 31/12 y colocarlos en plazo fijo o caja de ahorro en dólares en banco argentino evita BP sobre ese monto [Source](https://www.infobae.com/economia/2025/10/14/impuestos-a-la-hora-de-invertir-que-hay-que-pagarle-a-arca-por-tener-acciones-bonos-depositos-y-otras-colocaciones/).
- **Títulos públicos argentinos (bonos, letras, AL30, GD30): EXENTOS de BP.** Rotar a títulos públicos argentinos reduce carga de BP.

### 8.3 Beneficios por mantener activos más de X tiempo
**No existe en Argentina un treatment preferencial por plazo de tenencia** (a diferencia de "long-term capital gains" del IRS). Ganancia de capital de fuente extranjera tributa 15% sin importar el holding period. La única ventaja del largo plazo es el **diferimiento** del 15% hasta la realización.

### 8.4 Efecto residual del blanqueo 2024
Para contribuyentes que entraron al blanqueo (Ley 27.743 Título II, con etapas cerradas en 2024–2025):
- Costo computable de los bienes blanqueados = valor cotización 31/12/2023.
- El acceso al REIBP (si se adhirió a tiempo) deja el pago de BP 2024–2027 cubierto.
- No entraron al blanqueo: deben tributar BP normal y declarar ganancias normales.

---

## 9. CAMBIOS RECIENTES Y FUTUROS — JUSTIFICACIÓN DE "REGLAS VERSIONADAS"

### 9.1 Cambios últimos 12–18 meses
- **Ley 27.743 (27/06/2024):** MNI BP $292,9 M (2024); eliminación diferencial país/exterior; REIBP; blanqueo; bajada gradual alícuotas hasta 0,25% en 2027.
- **Decreto 608/2024 (11/07/2024):** reglamento Ley 27.743.
- **RG 5544, 5535, 5588/2024:** reglamentación REIBP y beneficio cumplidor.
- **Decreto 953/2024:** reestructuración AFIP → **ARCA** (Agencia de Recaudación y Control Aduanero). Todas las RG AFIP vigentes fueron absorbidas por ARCA; referencias legales a "AFIP" siguen válidas.
- **Decreto 977/2024 y 864/2024:** prórrogas del blanqueo hasta julio 2025.
- **Intercambio FATCA operativo:** primer envío septiembre 2024 (datos 2023).

### 9.2 Proyectos en curso (al 24/04/2026)
- Plena implementación CRS 2.0 / CARF (crypto) — sin cronograma argentino formal.
- Discusión política periódica de reformar Monotributo y Ganancias; a la fecha del documento no hay proyecto sancionado que afecte el tratamiento fiscal de inversiones en el exterior.

### 9.3 Justificación de arquitectura "reglas versionadas"
Entre 2023 y 2027 las alícuotas de Bienes Personales **cambian cada año**, el MNI se ajusta anualmente por IPC, y las tablas del Art. 94 LIG se ajustan semestralmente por RIPTE. El motor debe:

- Tabla `bp_scales` con clave `{periodo_fiscal, tipo_contribuyente}`.
- Tabla `art94_scales` con clave `{periodo_fiscal, semestre}`.
- Tabla `mni_bp` con clave `{periodo_fiscal}`.
- Tabla `tc_oficial_31_12` con clave `{periodo_fiscal}`.
- Trigger de validación: si el usuario corre una proyección con un período sin regla cargada, emitir warning y sugerir actualización.

---

## 10. FUENTES DE DATOS PARA EL SISTEMA

### 10.1 Tipo de cambio diario
- **Primaria oficial — BCRA API Estadísticas Cambiarias:**
  - Base URL: `https://api.bcra.gob.ar/estadisticascambiarias/v1.0/`
  - Endpoint cotizaciones por fecha: `/Cotizaciones/{fecha}` — devuelve todas las monedas a una fecha.
  - Endpoint histórico: `/Cotizaciones/USD?fechadesde={}&fechahasta={}`
  - Formato JSON; sin autenticación; público [Source](https://estadisticas-cambiarias.bcra.apidocs.ar/).
- **Secundaria — BNA HTML scraping:** `https://www.bna.com.ar/Cotizador/HistoricoPrincipales` (fallback).
- **Terciaria — estadísticasbcra.com:** `https://api.estadisticasbcra.com/usd_of_minorista` (requiere token gratuito) [Source](https://estadisticasbcra.com/api/documentacion).
- **dolarapi.com:** no oficial pero útil como sanity check.

### 10.2 Cotizaciones de activos al 31/12
- **Yahoo Finance (vía yfinance Python):** cobertura completa NYSE/NASDAQ; gratuito; histórico OHLC.
- **Alpha Vantage / Finnhub / Polygon:** APIs pagas, mayor confiabilidad histórica.
- **Datos oficiales del broker (Wallbit/IBKR statement al 31/12):** **fuente más auditable** porque coincide con lo que ARCA podría obtener vía FATCA.

### 10.3 Tabla de alícuotas ARCA
- **Formato:** HTML/PDF (no machine-readable oficial). Publicada en micrositios:
  - `https://www.afip.gob.ar/gananciasYBienes/bienes-personales/conceptos-basicos/alicuotas.asp`
  - `https://www.afip.gob.ar/sites/default/files/impuesto_sobre_los_bienes_personales_-_periodo_fiscal_al_2024.pdf`
- Se recomienda mantener tabla estática versionada en BD, actualizada manualmente al inicio de cada período fiscal.

### 10.4 Calendario de vencimientos
- **ARCA publica cronograma oficial vía RG anual** (típicamente entre noviembre y enero previo al período). No hay API pública; scraping del sitio o carga manual anual.
- Fuente de trabajo recomendada: consejo profesional jurisdiccional (CPCECABA, CPCESFE, etc.) publican el calendario consolidado en PDF.

### 10.5 Datos de withholding y 1099
- El broker emite **1099-DIV** (dividendos/distribuciones) y **1099-B** (ventas). No hay API unificada; el sistema debe parsear CSV/PDF exportado por el usuario.
- Para ETFs: QDI (Qualified Dividend Income) y Section 199A dividends son irrelevantes a fines fiscales argentinos.

---

## TABLA DE REFERENCIA RÁPIDA (schema-ready)

Columnas: `operation_type | aliquot | fx_type | fx_date_criterion | norma | due_date`

| operation_type | aliquot | fx_type | fx_date_criterion | norma | due_date_pf_2025 |
|---|---|---|---|---|---|
| `bp_assets_abroad` | `scale_0.5_0.75_1.0` (2025) | `BNA_divisa_comprador` | `last_business_day_before_31_12` | Ley 23.966 Art. 25 + Ley 27.743 Art. 64 | 11–16 jun 2026 (DDJJ) / 12–17 jun 2026 (pago) |
| `bp_cash_usd_abroad` | `scale_0.5_0.75_1.0` | `BNA_divisa_comprador` | `last_business_day_before_31_12` | Ley 23.966 Art. 22 | idem |
| `bp_cash_usd_ar_bank` | `EXEMPT` | — | — | Ley 23.966 Art. 21 inc. h | — |
| `bp_titulos_publicos_ar` | `EXEMPT` | — | — | Ley 23.966 Art. 21 inc. g | — |
| `dividend_foreign_stock` | `art94_progressive_5_to_35` | `BNA_divisa_comprador` | `pay_date` | LIG Art. 94 §1, Art. 140 | DDJJ 11–16 jun 2026 |
| `dividend_foreign_etf_equity` | `art94_progressive_5_to_35` | `BNA_divisa_comprador` | `pay_date` | LIG Art. 94 §1 | idem |
| `dividend_foreign_etf_fixed_income` (SGOV, BIL, SHV) | `art94_progressive_5_to_35` | `BNA_divisa_comprador` | `pay_date` | LIG Art. 94 §1 | idem |
| `interest_tbills_direct` | `art94_progressive_5_to_35` | `BNA_divisa_comprador` | `payment_date` | LIG Art. 94 §1, Art. 140 | idem |
| `capital_gain_foreign_stock` | `0.15` | `BNA_divisa_vendedor` | `trade_date` (venta) y `trade_date` (compra) | LIG Art. 94 §3, Art. 158 | idem |
| `capital_gain_foreign_etf` | `0.15` | `BNA_divisa_vendedor` | `trade_date` | LIG Art. 94 §3 | idem |
| `foreign_tax_credit_wht_30` | `creditable_up_to_ar_liability_increase` | `BNA_divisa_comprador` | `withholding_date` | LIG Art. 1, 165, 166 | imputable en DDJJ |
| `capital_loss_foreign` | `specific_quebranto_5_years` | — | — | LIG Art. 132 | arrastrable 5 años |

---

## ALERTAS DE INCERTIDUMBRE CONSOLIDADAS (para decisiones de diseño)

1. **MNI BP 2025 ($384.728.044,57) es estimación consensuada**, aún no formalizada por RG ARCA al 24/04/2026. Parametrizar con override. ⚠
2. **Alícuotas BP 2025 — algunas fuentes periodísticas siguen publicando 4 tramos (0,5/0,75/1/1,25).** La interpretación correcta de Ley 27.743 Art. 64 es 3 tramos (0,5/0,75/1). Adoptar los 3 tramos salvo contraindicación expresa de ARCA. ⚠
3. **Tratamiento de distribuciones de ETFs de renta fija (SGOV/BIL/SHV):** no hay dictamen ARCA específico. Mayoría de doctrina los trata como dividendo → escala Art. 94. Alícuota final idéntica a tratarlos como interés. ✓ Bajo impacto.
4. **TC comprador vs vendedor, divisa vs billete:** la norma dice "comprador BNA divisa" para BP e ingresos y "vendedor BNA divisa" para costos/inversiones. Algunos asesores usan billete; diferencia de 1–3%. El motor debe usar **divisa** consistentemente. ⚠
5. **Método de imputación del costo (FIFO vs promedio):** no hay norma específica para fuente extranjera. FIFO es el default práctico alineado con el 1099-B del broker. Hacerlo configurable. ⚠
6. **Wash-sale rules:** no existen en Argentina formalmente. Sin jurisprudencia sobre abuso. Bajo riesgo pero recomendable preservar evidencia documental. ⚠
7. **Cómputo del crédito fiscal por WHT 30%:** el límite es el "incremento de la obligación argentina originado por la renta extranjera" — cálculo no trivial si el contribuyente tiene otros ingresos argentinos. Requiere cómputo proporcional. ⚠
8. **REIBP caducado para nuevos adherentes** pero crítico si el usuario adhirió: suprime BP 2023–2027. Verificar flag al inicio del cálculo. ✓
9. **Intercambio FATCA:** ARCA tiene datos de intereses/dividendos 2023 y 2024 (y en septiembre 2026 recibirá 2025). **No** tiene saldos ni ventas. Usar esto como argumento UX para motivar la declaración correcta. ✓
10. **Doble cálculo BP en casa habitación extranjera:** si el contribuyente tiene una vivienda en el exterior como "casa habitación", el MNI especial de $1.346 M **NO aplica** (solo aplica a inmuebles argentinos destinados a casa habitación). El motor debe marcar este case. ⚠

---

## REFERENCIAS NORMATIVAS CLAVE

- **Ley 23.966 (Título VI — Impuesto sobre los Bienes Personales)**, texto vigente con modif. Ley 27.743.
- **Ley 20.628 (t.o. 2019) — Impuesto a las Ganancias**, modif. Ley 27.430 y posteriores [Source](https://servicios.infoleg.gob.ar/infolegInternet/anexos/330000-334999/332890/texact.htm).
- **Ley 27.743 (BO 8/7/2024)** — Medidas Fiscales Paliativas y Relevantes [Source](https://servicios.infoleg.gob.ar/infolegInternet/anexos/400000-404999/401268/norma.htm).
- **Decreto 127/1996** — reglamentario Bienes Personales [Source](https://www.argentina.gob.ar/normativa/nacional/decreto-127-1996-33500/texto).
- **Decreto 1344/1998** — reglamentario Ganancias.
- **Decreto 1170/2018** — reglamentación reforma Ley 27.430.
- **Decreto 608/2024** — reglamentario Ley 27.743.
- **Decreto 953/2024** — creación ARCA.
- **RG ARCA/AFIP 5544/2024, 5535/2024, 5588/2024** — REIBP y Beneficio Cumplidor [Source](https://www.boletinoficial.gob.ar/detalleAviso/primera/311999/20240809) [Source](https://www.boletinoficial.gob.ar/detalleAviso/primera/315959/20241023).
- **Acuerdo IGA FATCA Argentina-EE.UU. (5/12/2022, vigencia 1/1/2023)** — texto publicado en Boletín Oficial 13/03/2024.
- **Dictamen DAT 4/99** — tratamiento de dividendos del exterior [Source](https://trivia.consejo.org.ar/ficha/938-dictamen_dat_499._impuesto_a_las_ganancias._dividendos_distribuidos_por_una_sociedad_del_exterior_a_un_residente_del_pais._su_tratamiento).

---

**Nota final sobre vigencia:** este documento fue compilado con información disponible al 24/04/2026. Las alícuotas de Bienes Personales 2025 y el MNI 2025 están sujetos a confirmación por RG ARCA definitiva. Las tablas del Art. 94 LIG se actualizan semestralmente; el motor debe consultar la última versión antes de cada cálculo definitivo. Para uso del software de producción, validar periódicamente contra el Boletín Oficial (boletinoficial.gob.ar) y el micrositio de Ganancias y Bienes Personales de ARCA (afip.gob.ar/gananciasYBienes/).