// ARA OS · Inferencia v0.2.0
module.exports = function setupAraOSInferencia(app) {
  const { validToken } = require("./lib/auth.cjs");
  function tokenValido(req) { return validToken(req.query.token); }
  function cors(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
  const { google } = require("googleapis");
  function getSheetsClient() {
    const auth = new google.auth.OAuth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET);
    auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    return google.sheets({ version: "v4", auth });
  }
  async function leerHoja(rango) {
    const sheets = getSheetsClient();
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: rango });
    return res.data.values || [];
  }
  async function escribirFila(rango, valores) {
    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.append({ spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: rango, valueInputOption: "RAW", requestBody: { values: [valores] } });
  }
  async function actualizarFila(rango, valores) {
    const sheets = getSheetsClient();
    await sheets.spreadsheets.values.update({ spreadsheetId: process.env.GOOGLE_SHEETS_ID, range: rango, valueInputOption: "RAW", requestBody: { values: [valores] } });
  }
  const COLS_PISO = ["telefono","comunidad","vivienda","nota_simple","nombre","paso_actual","documento_actual","estado_expediente","fecha_inicio","fecha_primer_contacto","fecha_ultimo_contacto","fecha_limite_documentacion","fecha_limite_firma","documentos_completos","alerta_plazo","documentos_recibidos","documentos_pendientes","documentos_opcionales_pendientes","ultimo_documento_fallido","fecha_ultimo_fallo","reintento_hasta","motivo_bloqueo_actual","prioridad_expediente","requiere_intervencion_humana","documentos_opcionales_descartados","notificacion_financiacion_enviada","documentos_recibidos_sin_archivo","documentos_no_aplica","est_piso_toma_datos","est_piso_nif_toma_datos","est_piso_titularidad","est_piso_empadronamiento","est_piso_contrato_alquiler","est_piso_nif_propietario","est_piso_licencia_apertura","est_piso_escrituras_empresa","est_piso_poderes","est_piso_nif_apoderado","est_piso_meses_financiar","est_piso_nif_financiado","est_piso_justificante_ingresos","est_piso_cuenta_bancaria","est_piso_disidente","est_piso_contrato","est_piso_pago"];
  const COLS_COM = ["comunidad","direccion","presidente","telefono_presidente","email_presidente","estado_comunidad","fecha_inicio","fecha_limite_documentacion","fecha_limite_firma","observaciones","tipo_via","earth","administrador","telefono_administrador","email_administrador","fase_presupuesto","fecha_solicitud_pto","fecha_visita_pto","fecha_envio_pto","fecha_ultimo_seguimiento_pto","decision_pto","fecha_decision_pto","pto_total","mano_obra_previsto","mano_obra_real","material_previsto","material_real","beneficio_previsto","beneficio_real","beneficio_desvio","tiempo_previsto","tiempo_real","tiempo_desvio","notas_pto","mails_enviados","mails_ultimo_envio","fecha_proximo_mail_manual","fecha_ultimo_reenvio_pto","fecha_visita_emasesa","fecha_documentacion_completa","fecha_contratos_pagos_completa","modo_documentacion","est_ccpp_contrato_firmado","est_ccpp_toma_datos","est_ccpp_nif","est_ccpp_acta_pte","est_ccpp_acta_pto","est_ccpp_renuncia_gp","est_ccpp_factura_emasesa","est_ccpp_contrato","est_ccpp_pago","fecha_envio_contratos_pagos","fecha_cycp_completa","mails_manuales","fecha_limite_documentacion_vecinos","motivo_rechazo"];
  const COLS_BLOQUEO = ["comunidad","tipo_bloqueo","severidad","pelota_en","impacto","vecinos_afectados","accion_exacta","detectado_por","detectado_en","ultimo_movimiento_humano","dias_sin_movimiento","override_por","override_en","override_comentario","esperar_hasta","proxima_revision","resuelto","resuelto_en","owner","owner_override","owner_override_por","comentario_operativo"];
  function filaAPiso(row) { const o={}; COLS_PISO.forEach((k,i)=>{o[k]=(row[i]||"").trim();}); return o; }
  function filaAComunidad(row) { const o={}; COLS_COM.forEach((k,i)=>{o[k]=(row[i]||"").trim();}); return o; }
  function filaABloqueo(row) { const o={}; COLS_BLOQUEO.forEach((k,i)=>{o[k]=(row[i]||"").trim();}); o._rowIndex=row._rowIndex; return o; }
  function hoy() { return new Date().toISOString().slice(0,10); }
  function diasDesde(fecha) { if(!fecha)return null; const d=new Date(fecha); if(isNaN(d))return null; return Math.floor((new Date()-d)/86400000); }
  const OWNERSHIP = { DOC_PENDIENTE:"Guillermo", FIRMA_PENDIENTE:"Guillermo", PAGO_PENDIENTE:"Guillermo", CONTRATOS_PAGOS:"Guillermo", EMASESA_PENDIENTE:"Guillermo", FINANCIACION:"José Manuel", ADMIN_SILENCIO:"José Manuel", PRESIDENTE_INACTIVO:"José Manuel", PORCENTAJE_MINIMO:"José Manuel", INCIDENCIA_TECNICA:"José Manuel", MATERIAL_PENDIENTE:"José Manuel" };
  const FASES_GUILLERMO = ["05_documentacion","06_visita_emasesa","07_pte_cycp","08_cycp"];
  function inferirOwner(tipo, fase) {
    if (tipo==="SIN_MOVIMIENTO") return FASES_GUILLERMO.includes(fase) ? "Guillermo" : "José Manuel";
    return OWNERSHIP[tipo] || "José Manuel";
  }
  function resolverOwner(tipo, fase, override) { return (override&&override.trim()) ? override.trim() : inferirOwner(tipo, fase); }
  function pisoTienePagoPendiente(piso) { return (piso.est_piso_pago||"").toUpperCase().trim()==="F"; }
  function pisoTieneFinanciacion(piso) { const m=(piso.est_piso_meses_financiar||"").trim(); if(!m)return false; return ["est_piso_nif_financiado","est_piso_justificante_ingresos","est_piso_cuenta_bancaria"].some(k=>{ const v=(piso[k]||"").toUpperCase(); return v&&v!=="OK"&&v!=="NO APLICA"; }); }
  function pisoTieneDocPendiente(piso) { if(piso.documentos_completos==="si"||piso.documentos_completos==="SI")return false; if(piso.estado_expediente==="CCPP"||piso.estado_expediente==="historico")return false; return (piso.documentos_pendientes||"").trim().length>0; }
  function comunidadTieneContratosPendientes(com) { return !com.fecha_contratos_pagos_completa && !!com.fecha_documentacion_completa; }
  function comunidadSinMovimiento(com, pisos) {
    let fechaMax=null;
    for(const p of pisos){ if(p.fecha_ultimo_contacto){const d=new Date(p.fecha_ultimo_contacto);if(!isNaN(d)&&(!fechaMax||d>fechaMax))fechaMax=d;} }
    if(!fechaMax){ if(com.fecha_inicio){const dias=diasDesde(com.fecha_inicio);return dias!==null&&dias>21?{dias,fecha:com.fecha_inicio}:null;} return null; }
    const dias=Math.floor((new Date()-fechaMax)/86400000);
    return dias>21?{dias,fecha:fechaMax.toISOString().slice(0,10)}:null;
  }
  function inferirBloqueos(com, pisos) {
    const bloqueos=[];
    const fase=com.fase_presupuesto||"";
    if(com.fecha_cycp_completa)return[];
    if(!fase||fase.startsWith("ZZ"))return[];
    const FASES_ACTIVAS=["04_aceptacion_pto","05_documentacion","06_visita_emasesa","07_pte_cycp","07_PTE_CYCP","08_cycp","08_CYCP"];
    if(!FASES_ACTIVAS.includes(fase)&&!com.fecha_documentacion_completa&&!com.fecha_contratos_pagos_completa)return[];
    const pisosDoc=pisos.filter(pisoTieneDocPendiente);
    if(pisosDoc.length>0){ const v=pisosDoc.map(p=>p.vivienda).join(", "); const p=[...new Set(pisosDoc.flatMap(p=>(p.documentos_pendientes||"").split(/[,;|]+/).map(d=>d.trim()).filter(Boolean)))].slice(0,5).join(", "); bloqueos.push({tipo_bloqueo:"DOC_PENDIENTE",severidad:pisosDoc.length>=3?"critica":"seguimiento",pelota_en:"vecino",impacto:"bloquea_inicio",vecinos_afectados:v,accion_exacta:"Reclamar documentación: "+(p||"ver pisos"),ultimo_movimiento_humano:"",dias_sin_movimiento:""}); }
    const pisosPago=pisos.filter(pisoTienePagoPendiente);
    if(pisosPago.length>0){ bloqueos.push({tipo_bloqueo:"PAGO_PENDIENTE",severidad:"critica",pelota_en:"vecino",impacto:"bloquea_cobro",vecinos_afectados:pisosPago.map(p=>p.vivienda).join(", "),accion_exacta:"Reclamar pago a "+pisosPago.length+" vecino(s)",ultimo_movimiento_humano:"",dias_sin_movimiento:""}); }
    const pisosFin=pisos.filter(pisoTieneFinanciacion);
    if(pisosFin.length>0){ bloqueos.push({tipo_bloqueo:"FINANCIACION",severidad:"seguimiento",pelota_en:"financiera",impacto:"bloquea_inicio",vecinos_afectados:pisosFin.map(p=>p.vivienda).join(", "),accion_exacta:"Documentación financiación incompleta en "+pisosFin.length+" piso(s)",ultimo_movimiento_humano:"",dias_sin_movimiento:""}); }
    if(comunidadTieneContratosPendientes(com)){ bloqueos.push({tipo_bloqueo:"CONTRATOS_PAGOS",severidad:"critica",pelota_en:"administrador",impacto:"bloquea_cobro",vecinos_afectados:"",accion_exacta:"Gestionar contratos y cartas de pago con administrador",ultimo_movimiento_humano:"",dias_sin_movimiento:""}); }
    const sinMov=comunidadSinMovimiento(com,pisos);
    if(sinMov&&bloqueos.length===0){ bloqueos.push({tipo_bloqueo:"SIN_MOVIMIENTO",severidad:sinMov.dias>30?"critica":"seguimiento",pelota_en:"nosotros",impacto:"bloquea_ejecucion",vecinos_afectados:"",accion_exacta:"Sin movimiento humano en "+sinMov.dias+" días",ultimo_movimiento_humano:sinMov.fecha,dias_sin_movimiento:String(sinMov.dias)}); }
    return bloqueos;
  }
  async function ejecutarInferencia(escribir) {
    const [rowsCom,rowsPisos,rowsBloqueos]=await Promise.all([leerHoja("comunidades!A:BC"),leerHoja("pisos!A:AS"),leerHoja("bloqueos_operativos!A:V")]);
    const comunidades=[]; for(let i=1;i<rowsCom.length;i++){if(!rowsCom[i][0])continue;comunidades.push(filaAComunidad(rowsCom[i]));}
    const pisosPorComunidad={}; for(let i=1;i<rowsPisos.length;i++){if(!rowsPisos[i][0])continue;const p=filaAPiso(rowsPisos[i]);if(!p.comunidad)continue;if(!pisosPorComunidad[p.comunidad])pisosPorComunidad[p.comunidad]=[];pisosPorComunidad[p.comunidad].push(p);}
    const bloqueosExistentes={}; for(let i=1;i<rowsBloqueos.length;i++){const row=[...rowsBloqueos[i]];row._rowIndex=i+1;const b=filaABloqueo(row);if(!b.comunidad)continue;bloqueosExistentes[b.comunidad+"||"+b.tipo_bloqueo]=b;}
    const resumen={comunidades_analizadas:0,bloqueos_inferidos:0,bloqueos_nuevos:0,bloqueos_actualizados:0,bloqueos_respetados:0,detalle:[]};
    for(const com of comunidades){
      const pisos=pisosPorComunidad[com.comunidad]||[];
      const bloqueos=inferirBloqueos(com,pisos);
      if(bloqueos.length===0)continue;
      resumen.comunidades_analizadas++;
      resumen.bloqueos_inferidos+=bloqueos.length;
      for(const b of bloqueos){
        const clave=com.comunidad+"||"+b.tipo_bloqueo;
        const existente=bloqueosExistentes[clave];
        if(existente&&existente.override_por){resumen.bloqueos_respetados++;continue;}
        if(existente&&existente.resuelto==="si"){resumen.bloqueos_respetados++;continue;}
        const ownerFinal=resolverOwner(b.tipo_bloqueo,com.fase_presupuesto||"",existente?(existente.owner_override||""):"");
        const fila=[com.comunidad,b.tipo_bloqueo,b.severidad,b.pelota_en,b.impacto,b.vecinos_afectados,b.accion_exacta,"sistema",hoy(),b.ultimo_movimiento_humano,b.dias_sin_movimiento,"","","","","","no","",ownerFinal,existente?(existente.owner_override||""):"",existente?(existente.owner_override_por||""):"",existente?(existente.comentario_operativo||""):""];
        if(!existente){
          resumen.bloqueos_nuevos++;
          resumen.detalle.push({accion:"nuevo",comunidad:com.comunidad,tipo:b.tipo_bloqueo,severidad:b.severidad,owner:ownerFinal,accion_exacta:b.accion_exacta});
          if(escribir)await escribirFila("bloqueos_operativos!A:V",fila);
        } else {
          resumen.bloqueos_actualizados++;
          resumen.detalle.push({accion:"actualizado",comunidad:com.comunidad,tipo:b.tipo_bloqueo,owner:ownerFinal});
          if(escribir)await actualizarFila(`bloqueos_operativos!A${existente._rowIndex}:V${existente._rowIndex}`,fila);
        }
      }
    }
    return resumen;
  }
  app.options("/api/ara-os/inferencia",(req,res)=>{cors(res);res.status(204).end();});
  app.get("/api/ara-os/inferencia",async(req,res)=>{cors(res);if(!tokenValido(req))return res.status(403).json({error:"No autorizado"});try{const r=await ejecutarInferencia(false);res.json({...r,modo:"simulacion"});}catch(err){console.error("[ara-os-inferencia]",err.message);res.status(500).json({error:err.message});}});
  app.post("/api/ara-os/inferencia",async(req,res)=>{cors(res);if(!tokenValido(req))return res.status(403).json({error:"No autorizado"});try{const r=await ejecutarInferencia(true);res.json({...r,modo:"escritura"});}catch(err){console.error("[ara-os-inferencia]",err.message);res.status(500).json({error:err.message});}});
  console.log("[ara-os-inferencia] v0.2.0 · ownership Guillermo/JM · GET simula · POST escribe");
};
